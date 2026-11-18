const Variant = require("../models/variant");
const logActivity = require("../middleware/activity-log");

function publicVariant(variant) {
  return {
    id: variant.id,
    name: variant.name,
    quantity: Number(variant.quantity),
    unit: variant.unit,
    unitPrice: Number(variant.unitPrice),
    createdAt: variant.createdAt,
  };
}

function validVariant(body) {
  return typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 150 &&
    Number.isInteger(Number(body.quantity)) && Number(body.quantity) >= 0 &&
    typeof body.unit === "string" && body.unit.trim().length > 0 && body.unit.trim().length <= 40 &&
    Number.isFinite(Number(body.unitPrice)) && Number(body.unitPrice) >= 0;
}

async function listVariants(_req, res) {
  const variants = await Variant.findAll({ order: [["createdAt", "DESC"]] });
  res.json({ variants: variants.map(publicVariant) });
}

async function createVariant(req, res) {
  const body = req.body ?? {};
  if (!validVariant(body)) {
    return res.status(400).json({ error: "Nama varian, jumlah, satuan, dan harga satuan yang valid wajib diisi." });
  }

  const variant = await Variant.create({
    name: body.name.trim(),
    quantity: Number(body.quantity),
    unit: body.unit.trim(),
    unitPrice: Number(body.unitPrice),
  });
  await logActivity(req, {
    action: "create",
    entityType: "variant",
    entityId: variant.id,
    details: { name: variant.name, quantity: variant.quantity, unit: variant.unit },
  });
  res.status(201).json({ variant: publicVariant(variant) });
}

async function updateVariant(req, res) {
  const variant = await Variant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: "Varian tidak ditemukan." });

  const body = req.body ?? {};
  const allowedFields = ["name", "quantity", "unit", "unitPrice"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field)) ||
    !validVariant({ ...variant.toJSON(), ...body })) {
    return res.status(400).json({ error: "Data varian tidak valid." });
  }

  if (body.name !== undefined) variant.name = body.name.trim();
  if (body.quantity !== undefined) variant.quantity = Number(body.quantity);
  if (body.unit !== undefined) variant.unit = body.unit.trim();
  if (body.unitPrice !== undefined) variant.unitPrice = Number(body.unitPrice);
  await variant.save();
  await logActivity(req, {
    action: "update",
    entityType: "variant",
    entityId: variant.id,
    details: { changedFields: Object.keys(body), name: variant.name },
  });
  res.json({ variant: publicVariant(variant) });
}

async function deleteVariant(req, res) {
  const variant = await Variant.findByPk(req.params.id);
  if (!variant) return res.status(404).json({ error: "Varian tidak ditemukan." });
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
