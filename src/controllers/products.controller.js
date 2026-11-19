const { Op } = require("sequelize");
const sequelize = require("../config/database");
const Product = require("../models/product");
const Branch = require("../models/branch");
const ActivityLog = require("../models/activity-log");
const logActivity = require("../middleware/activity-log");

const STATUSES = new Set(["pending", "di_gudang", "di_toko", "di_spg", "di_collecting", "terjual", "rusak"]);

function publicProduct(product) {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    branchId: product.branchId,
    branch: product.branchRecord?.name ?? "—",
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function parseDate(value, endOfDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  if (normalized.getUTCFullYear() !== year || normalized.getUTCMonth() !== month - 1 || normalized.getUTCDate() !== day) return undefined;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function listProductBranches(_req, res) {
  const branches = await Branch.findAll({ attributes: ["id", "name"], order: [["name", "ASC"]] });
  res.json({ branches });
}

async function listProducts(req, res) {
  const { status, search, branchId, startDate, endDate } = req.query;
  if (status && !STATUSES.has(status)) return res.status(400).json({ error: "Status produk tidak valid." });
  const start = parseDate(startDate);
  const end = parseDate(endDate, true);
  if (start === undefined || end === undefined || (start && end && start > end)) {
    return res.status(400).json({ error: "Rentang tanggal tidak valid." });
  }
  const where = {};
  if (status) where.status = status;
  if (branchId) {
    if (!/^\d+$/.test(branchId)) return res.status(400).json({ error: "Cabang tidak valid." });
    where.branchId = Number(branchId);
  }
  if (search) {
    const query = `%${String(search).trim().replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = [{ name: { [Op.like]: query } }, { barcode: { [Op.like]: query } }];
  }
  if (start || end) {
    where.updatedAt = {};
    if (start) where.updatedAt[Op.gte] = start;
    if (end) where.updatedAt[Op.lte] = end;
  }
  const products = await Product.findAll({
    where,
    include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
    order: [["updatedAt", "DESC"]],
  });
  res.json({ products: products.map(publicProduct) });
}

async function moveWarehouseProducts(req, res) {
  const direction = req.body?.direction;
  const barcodes = req.body?.barcodes;
  if ((direction !== "in" && direction !== "out") || !Array.isArray(barcodes) || barcodes.length === 0 ||
    barcodes.length > 500 || barcodes.some((barcode) => typeof barcode !== "string" || !barcode.trim() || barcode.length > 120)) {
    return res.status(400).json({ error: "Arah pergerakan dan daftar kode barcode yang valid wajib diisi." });
  }
  const normalized = barcodes.map((barcode) => barcode.trim());
  if (new Set(normalized).size !== normalized.length) {
    return res.status(400).json({ error: "Kode barcode yang sama tidak boleh dimasukkan lebih dari sekali." });
  }
  const fromStatus = direction === "in" ? "pending" : "di_gudang";
  const toStatus = direction === "in" ? "di_gudang" : "di_toko";
  const result = await sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { barcode: normalized },
      include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byBarcode = new Map(products.map((product) => [product.barcode, product]));
    const missing = normalized.filter((barcode) => !byBarcode.has(barcode));
    if (missing.length) return { invalid: `Kode QR tidak ditemukan: ${missing.join(", ")}` };
    const unavailable = products.filter((product) => product.status !== fromStatus);
    if (unavailable.length) {
      return { invalid: `Status barang tidak sesuai: ${unavailable.map((product) => `${product.barcode} (${product.status})`).join(", ")}` };
    }
    for (const product of products) {
      product.status = toStatus;
      await product.save({ transaction });
    }
    return { products: normalized.map((barcode) => byBarcode.get(barcode)) };
  });
  if (result.invalid) return res.status(400).json({ error: result.invalid });
  for (const product of result.products) {
    await logActivity(req, {
      action: "update",
      entityType: "product",
      entityId: product.id,
      details: {
        barcode: product.barcode,
        name: product.name,
        direction,
        fromStatus,
        toStatus,
        branch: product.branchRecord?.name ?? "—",
      },
    });
  }
  res.json({ products: result.products.map(publicProduct) });
}

async function getProduct(req, res) {
  const product = await Product.findByPk(req.params.id, {
    include: [{ model: Branch, as: "branchRecord", attributes: ["name"] }],
  });
  if (!product) return res.status(404).json({ error: "Produk tidak ditemukan." });
  const activityLogs = await ActivityLog.findAll({
    where: {
      [Op.or]: [
        { entityId: product.barcode },
        sequelize.where(sequelize.json("details.barcode"), product.barcode),
      ],
    },
    order: [["createdAt", "DESC"]],
  });
  res.json({
    product: publicProduct(product),
    activityLogs: activityLogs.map((log) => ({
      id: log.id,
      username: log.username,
      action: log.action,
      createdAt: log.createdAt,
    })),
  });
}

async function deleteProduct(req, res) {
  const product = await Product.findByPk(req.params.id);
  if (!product) return res.status(404).json({ error: "Produk tidak ditemukan." });
  const deletedProduct = { id: product.id, name: product.name, barcode: product.barcode };
  await product.destroy();
  await logActivity(req, {
    action: "delete",
    entityType: "product",
    entityId: deletedProduct.id,
    details: deletedProduct,
  });
  res.status(204).end();
}

module.exports = { deleteProduct, getProduct, listProductBranches, listProducts, moveWarehouseProducts };
