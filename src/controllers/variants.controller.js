const { Op } = require("sequelize");
const Variant = require("../models/variant");
const Branch = require("../models/branch");
const Product = require("../models/product");
const logActivity = require("../middleware/activity-log");
const { paginationFromQuery, paginationMetadata } = require("../utils/pagination");
const { assignedBranchId } = require("../utils/user-branch");

function publicVariant(variant) {
  return {
    id: variant.id,
    name: variant.name,
    quantity: Number(variant.quantity),
    unit: variant.unit,
    unitPrice: Number(variant.unitPrice),
    branchId: variant.branchId,
    branchName: variant.branchRecord?.name ?? null,
    createdAt: variant.createdAt,
  };
}

function validVariant(body) {
  return typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 150 &&
    Number.isInteger(Number(body.quantity)) && Number(body.quantity) >= 0 &&
    typeof body.unit === "string" && body.unit.trim().length > 0 && body.unit.trim().length <= 40 &&
    Number.isFinite(Number(body.unitPrice)) && Number(body.unitPrice) >= 0 &&
    Number.isInteger(Number(body.branchId)) && Number(body.branchId) >= 1;
}

async function listVariants(req, res) {
  const where = {};
  if (req.query.branchId !== undefined) {
    if (!/^\d+$/.test(req.query.branchId)) {
      return res.status(400).json({ error: "Cabang tidak valid." });
    }
    where.branchId = Number(req.query.branchId);
  }
  const branchId = assignedBranchId(req);
  if (branchId !== null) where.branchId = branchId;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = req.query.search.trim().replace(/[\\%_]/g, "\\$&");
    where.name = { [Op.like]: `%${search}%` };
  }
  const pagination = paginationFromQuery(req.query);
  const options = {
    where,
    include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
    order: [["createdAt", "DESC"]],
  };
  const result = pagination
    ? await Variant.findAndCountAll({ ...options, limit: pagination.limit, offset: pagination.offset })
    : { rows: await Variant.findAll(options), count: null };
  const payload = { variants: result.rows.map(publicVariant) };
  if (pagination) payload.pagination = paginationMetadata(pagination, result.count);
  res.json(payload);
}

async function createVariant(req, res) {
  const body = req.body ?? {};
  const branchId = assignedBranchId(req) ?? Number(body.branchId);
  if (!validVariant({ ...body, branchId })) {
    return res.status(400).json({ error: "Nama varian, jumlah, satuan, harga satuan, dan cabang yang valid wajib diisi." });
  }
  const branch = await Branch.findByPk(branchId);
  if (!branch) return res.status(404).json({ error: "Cabang tidak ditemukan." });

  const variant = await Variant.create({
    name: body.name.trim(),
    quantity: Number(body.quantity),
    unit: body.unit.trim(),
    unitPrice: Number(body.unitPrice),
    branchId,
  });
  const savedVariant = await Variant.findByPk(variant.id, {
    include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
  });
  await logActivity(req, {
    action: "create",
    entityType: "variant",
    entityId: variant.id,
    details: { name: variant.name, quantity: variant.quantity, unit: variant.unit, branchId: branch.id },
  });
  res.status(201).json({ variant: publicVariant(savedVariant) });
}

async function updateVariant(req, res) {
  const assignedId = assignedBranchId(req);
  const variant = await Variant.findOne({
    where: { id: req.params.id, ...(assignedId === null ? {} : { branchId: assignedId }) },
    include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
  });
  if (!variant) return res.status(404).json({ error: "Varian tidak ditemukan." });

  const body = req.body ?? {};
  const allowedFields = ["name", "quantity", "unit", "unitPrice", "branchId"];
  const normalizedBody = {
    ...body,
    ...(assignedId === null ? {} : { branchId: assignedId }),
  };
  if (Object.keys(body).some((field) => !allowedFields.includes(field)) ||
    !validVariant({ ...variant.toJSON(), ...normalizedBody })) {
    return res.status(400).json({ error: "Data varian tidak valid." });
  }

  const branchId = assignedId ?? Number(body.branchId ?? variant.branchId);
  const branch = await Branch.findByPk(branchId);
  if (!branch) return res.status(404).json({ error: "Cabang tidak ditemukan." });
  if (branchId !== Number(variant.branchId)) {
    const productBranches = await Product.findAll({
      attributes: ["branchId"],
      where: { variantId: variant.id },
      group: ["branchId"],
      raw: true,
    });
    if (productBranches.some((product) => Number(product.branchId) !== branchId)) {
      return res.status(409).json({ error: "Cabang varian tidak dapat diubah karena sudah digunakan produk dari cabang lain." });
    }
  }

  if (body.name !== undefined) variant.name = body.name.trim();
  if (body.quantity !== undefined) variant.quantity = Number(body.quantity);
  if (body.unit !== undefined) variant.unit = body.unit.trim();
  if (body.unitPrice !== undefined) variant.unitPrice = Number(body.unitPrice);
  if (body.branchId !== undefined) variant.branchId = branchId;
  await variant.save();
  await logActivity(req, {
    action: "update",
    entityType: "variant",
    entityId: variant.id,
    details: { changedFields: Object.keys(body), name: variant.name, branchId: variant.branchId },
  });
  const savedVariant = await Variant.findByPk(variant.id, {
    include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
  });
  res.json({ variant: publicVariant(savedVariant) });
}

async function deleteVariant(req, res) {
  const assignedId = assignedBranchId(req);
  const variant = await Variant.findOne({
    where: { id: req.params.id, ...(assignedId === null ? {} : { branchId: assignedId }) },
  });
  if (!variant) return res.status(404).json({ error: "Varian tidak ditemukan." });
  if (await Product.count({ where: { variantId: variant.id } })) {
    return res.status(409).json({ error: "Varian tidak dapat dihapus karena masih digunakan oleh produk." });
  }
  const deletedVariant = { id: variant.id, name: variant.name };
  await variant.destroy();
  await logActivity(req, {
    action: "delete",
    entityType: "variant",
    entityId: deletedVariant.id,
    details: deletedVariant,
  });
  res.status(204).end();
}

module.exports = { listVariants, createVariant, updateVariant, deleteVariant };
