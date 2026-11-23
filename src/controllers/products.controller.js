const { Op } = require("sequelize");
const { randomUUID } = require("node:crypto");
const sequelize = require("../config/database");
const Product = require("../models/product");
const Branch = require("../models/branch");
const Variant = require("../models/variant");
const ActivityLog = require("../models/activity-log");
const logActivity = require("../middleware/activity-log");

const STATUSES = new Set(["pending", "di_gudang", "di_toko", "di_spg", "di_collecting", "terjual", "rusak"]);

function publicProduct(product) {
  return {
    id: product.id,
    barcode: product.barcode,
    branchId: product.branchId,
    branch: product.branchRecord?.name ?? "—",
    variantId: product.variantId,
    variantName: product.variantRecord?.name ?? null,
    status: product.status,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function productIncludes() {
  return [
    { model: Branch, as: "branchRecord", attributes: ["name"] },
    { model: Variant, as: "variantRecord", attributes: ["name"] },
  ];
}

function createBarcode() {
  return `QR-${randomUUID()}`;
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
  const { status, search, branchId, startDate, endDate, start_date, end_date, variantId, total_data } = req.query;
  if (status && !STATUSES.has(status)) return res.status(400).json({ error: "Status produk tidak valid." });
  const usesCreatedAtDates = start_date !== undefined || end_date !== undefined;
  const rawStartDate = usesCreatedAtDates ? start_date : startDate;
  const rawEndDate = usesCreatedAtDates ? end_date : endDate;
  if ((rawStartDate !== undefined && typeof rawStartDate !== "string") ||
    (rawEndDate !== undefined && typeof rawEndDate !== "string")) {
    return res.status(400).json({ error: "Rentang tanggal tidak valid." });
  }
  const start = parseDate(rawStartDate);
  const end = parseDate(rawEndDate, true);
  if (start === undefined || end === undefined || (start && end && start > end)) {
    return res.status(400).json({ error: "Rentang tanggal tidak valid." });
  }
  const where = {};
  if (status) where.status = status;
  if (branchId) {
    if (typeof branchId !== "string" || !/^\d+$/.test(branchId)) return res.status(400).json({ error: "Cabang tidak valid." });
    where.branchId = Number(branchId);
  }
  if (variantId !== undefined) {
    if (typeof variantId !== "string" || !/^\d+$/.test(variantId)) {
      return res.status(400).json({ error: "Varian tidak valid." });
    }
    where.variantId = Number(variantId);
  }
  if (search) {
    const query = "%" + String(search).trim().replace(/[\\%_]/g, "\\$&") + "%";
    where[Op.or] = [
      { barcode: { [Op.like]: query } },
      { "$variantRecord.name$": { [Op.like]: query } },
    ];
  }
  if (start || end) {
    const dateField = usesCreatedAtDates ? "createdAt" : "updatedAt";
    where[dateField] = {};
    if (start) where[dateField][Op.gte] = start;
    if (end) where[dateField][Op.lte] = end;
  }
  const options = {
    where,
    include: productIncludes(),
    order: [
      [usesCreatedAtDates || variantId !== undefined || total_data !== undefined ? "createdAt" : "updatedAt", "DESC"],
      ["id", "DESC"],
    ],
  };
  if (total_data !== undefined) {
    const allowedTotals = new Set(["500", "1000", "1500", "2000"]);
    if (typeof total_data !== "string" || !allowedTotals.has(total_data)) {
      return res.status(400).json({ error: "Jumlah data tidak valid." });
    }
    options.limit = Number(total_data);
  }
  const products = await Product.findAll({
    ...options,
  });
  res.json({ products: products.map(publicProduct) });
}

async function generateProducts(req, res) {
  const branchId = Number(req.body?.branchId);
  const variantId = Number(req.body?.variantId);
  const quantity = Number(req.body?.quantity);
  if (!Number.isInteger(branchId) || branchId < 1 ||
    !Number.isInteger(variantId) || variantId < 1 ||
    !Number.isInteger(quantity) || quantity < 1 || quantity > 500) {
    return res.status(400).json({ error: "Cabang, varian, dan jumlah produk (1–500) wajib diisi." });
  }

  const barcodes = Array.from({ length: quantity }, () => createBarcode());
  const result = await sequelize.transaction(async (transaction) => {
    const [branch, variant] = await Promise.all([
      Branch.findByPk(branchId, { transaction, lock: transaction.LOCK.UPDATE }),
      Variant.findByPk(variantId, { transaction, lock: transaction.LOCK.UPDATE }),
    ]);
    if (!branch) return { branchNotFound: true };
    if (!variant) return { variantNotFound: true };
    if (Number(variant.branchId) !== branchId) return { variantBranchMismatch: true };

    await Product.bulkCreate(barcodes.map((barcode) => ({
      barcode,
      branchId,
      variantId,
      status: "pending",
    })), { transaction });

    const products = await Product.findAll({
      where: { barcode: barcodes },
      include: productIncludes(),
      order: [["id", "ASC"]],
      transaction,
    });
    return { products };
  });

  if (result.branchNotFound) return res.status(404).json({ error: "Cabang tidak ditemukan." });
  if (result.variantNotFound) return res.status(404).json({ error: "Varian tidak ditemukan." });
  if (result.variantBranchMismatch) {
    return res.status(400).json({ error: "Varian tidak tersedia untuk cabang yang dipilih." });
  }

  try {
    await ActivityLog.bulkCreate(result.products.map((product) => ({
      userId: req.user?.id ?? null,
      username: req.user?.username ?? null,
      action: "create",
      entityType: "product",
      entityId: String(product.id),
      details: {
        barcode: product.barcode,
        variantId: product.variantId,
        variantName: product.variantRecord?.name ?? null,
        branchId: product.branchId,
        branch: product.branchRecord?.name ?? "—",
      },
      ipAddress: req.ip?.slice(0, 45) ?? null,
      userAgent: req.get("user-agent")?.slice(0, 65535) ?? null,
    })));
  } catch (error) {
    console.error("Unable to write product generation activity logs:", error);
  }
  res.status(201).json({
    count: result.products.length,
    products: result.products.map(publicProduct),
  });
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
      include: productIncludes(),
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
        variantId: product.variantId,
        variantName: product.variantRecord?.name ?? null,
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
    include: productIncludes(),
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
  const product = await Product.findByPk(req.params.id, {
    include: [{ model: Variant, as: "variantRecord", attributes: ["name"] }],
  });
  if (!product) return res.status(404).json({ error: "Produk tidak ditemukan." });
  const deletedProduct = {
    id: product.id,
    variantId: product.variantId,
    variantName: product.variantRecord?.name ?? null,
    barcode: product.barcode,
  };
  await product.destroy();
  await logActivity(req, {
    action: "delete",
    entityType: "product",
    entityId: deletedProduct.id,
    details: deletedProduct,
  });
  res.status(204).end();
}

module.exports = { deleteProduct, generateProducts, getProduct, listProductBranches, listProducts, moveWarehouseProducts };
