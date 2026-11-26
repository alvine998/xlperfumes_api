const { Op } = require("sequelize");
const { randomUUID } = require("node:crypto");
const sequelize = require("../config/database");
const Product = require("../models/product");
const Branch = require("../models/branch");
const Variant = require("../models/variant");
const ActivityLog = require("../models/activity-log");
const StoreStock = require("../models/store-stock");
const logActivity = require("../middleware/activity-log");
const { paginationFromQuery, paginationMetadata } = require("../utils/pagination");
const { assignedBranchId } = require("../utils/user-branch");

const STATUSES = new Set(["pending", "di_gudang", "di_toko", "di_spg", "di_collecting", "terjual", "rusak"]);

function publicProduct(product) {
  return {
    id: product.id,
    barcode: product.barcode,
    branchId: product.branchId,
    storeId: product.storeId ?? null,
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

async function listProductBranches(req, res) {
  const pagination = paginationFromQuery(req.query);
  const branchId = assignedBranchId(req);
  const options = {
    attributes: ["id", "name"],
    where: branchId === null ? {} : { id: branchId },
    order: [["name", "ASC"]],
  };
  const result = pagination
    ? await Branch.findAndCountAll({ ...options, limit: pagination.limit, offset: pagination.offset })
    : { rows: await Branch.findAll(options), count: null };
  const payload = { branches: result.rows };
  if (pagination) payload.pagination = paginationMetadata(pagination, result.count);
  res.json(payload);
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
  const pagination = paginationFromQuery(req.query);
  if (status) where.status = status;
  if (branchId) {
    if (typeof branchId !== "string" || !/^\d+$/.test(branchId)) return res.status(400).json({ error: "Cabang tidak valid." });
    where.branchId = Number(branchId);
  }
  const assignedId = assignedBranchId(req);
  if (assignedId !== null) where.branchId = assignedId;
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
  let maxResults = null;
  if (total_data !== undefined) {
    const allowedTotals = new Set(["500", "1000", "1500", "2000"]);
    if (typeof total_data !== "string" || !allowedTotals.has(total_data)) {
      return res.status(400).json({ error: "Jumlah data tidak valid." });
    }
    maxResults = Number(total_data);
  }
  const result = pagination
    ? await Product.findAndCountAll({
      ...options,
      distinct: true,
      limit: Math.max(1, Math.min(
        pagination.limit,
        maxResults === null ? pagination.limit : maxResults - pagination.offset,
      )),
      offset: pagination.offset,
    })
    : { rows: await Product.findAll(options), count: null };
  const visibleRows = maxResults === null
    ? result.rows
    : result.rows.slice(0, Math.max(0, maxResults - pagination.offset));
  const payload = { products: visibleRows.map(publicProduct) };
  if (pagination) payload.pagination = paginationMetadata(
    pagination,
    maxResults === null ? result.count : Math.min(result.count, maxResults),
  );
  res.json(payload);
}

async function listPickupProducts(req, res) {
  const { search } = req.query;
  if (search !== undefined && typeof search !== "string") {
    return res.status(400).json({ error: "Kata pencarian tidak valid." });
  }

  const where = { status: "di_gudang" };
  const branchId = assignedBranchId(req);
  if (branchId !== null) where.branchId = branchId;
  const normalizedSearch = search?.trim();
  if (normalizedSearch) {
    const query = `%${normalizedSearch.replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = [
      { barcode: { [Op.like]: query } },
      { "$variantRecord.name$": { [Op.like]: query } },
    ];
  }

  const pagination = paginationFromQuery(req.query);
  const result = await Product.findAndCountAll({
    where,
    include: productIncludes(),
    distinct: true,
    order: [["updatedAt", "DESC"], ["id", "DESC"]],
    limit: pagination.limit,
    offset: pagination.offset,
  });
  res.json({
    products: result.rows.map(publicProduct),
    pagination: paginationMetadata(pagination, result.count),
  });
}

async function getOperationalDashboardSummary(req, res) {
  const branchId = assignedBranchId(req);
  const where = branchId === null ? {} : { branchId };
  const [rows, branch] = await Promise.all([
    Product.findAll({
      attributes: ["status", [sequelize.fn("COUNT", sequelize.col("id")), "count"]],
      where,
      group: ["status"],
      raw: true,
    }),
    branchId === null ? Promise.resolve(null) : Branch.findByPk(branchId, { attributes: ["name"] }),
  ]);

  const statusCounts = Object.fromEntries([...STATUSES].map((status) => [status, 0]));
  for (const row of rows) {
    if (Object.hasOwn(statusCounts, row.status)) statusCounts[row.status] = Number(row.count) || 0;
  }

  res.json({
    role: req.user.role,
    branchId,
    branch: branch?.name ?? null,
    statusCounts,
  });
}

async function generateProducts(req, res) {
  const branchId = assignedBranchId(req) ?? Number(req.body?.branchId);
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
  const branchId = assignedBranchId(req);
  const result = await sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { barcode: normalized, ...(branchId === null ? {} : { branchId }) },
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

async function pickWarehouseProducts(req, res) {
  const barcodes = req.body?.barcodes;
  if (!Array.isArray(barcodes) || barcodes.length === 0 || barcodes.length > 500 ||
    barcodes.some((barcode) => typeof barcode !== "string" || !barcode.trim() || barcode.length > 120)) {
    return res.status(400).json({ error: "Daftar kode barcode yang valid wajib diisi (maksimal 500 barang)." });
  }

  const normalized = barcodes.map((barcode) => barcode.trim());
  if (new Set(normalized).size !== normalized.length) {
    return res.status(400).json({ error: "Kode barcode yang sama tidak boleh dimasukkan lebih dari sekali." });
  }

  const statusByRole = { spg: "di_spg", collecting: "di_collecting" };
  const toStatus = statusByRole[req.user?.role];
  if (!toStatus) return res.status(403).json({ error: "Fitur ini hanya tersedia untuk pengguna SPG atau Collecting." });

  const branchId = assignedBranchId(req);
  const result = await sequelize.transaction(async (transaction) => {
    const products = await Product.findAll({
      where: { barcode: normalized, ...(branchId === null ? {} : { branchId }) },
      include: productIncludes(),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byBarcode = new Map(products.map((product) => [product.barcode, product]));
    const missing = normalized.filter((barcode) => !byBarcode.has(barcode));
    if (missing.length) return { invalid: `Kode QR tidak ditemukan: ${missing.join(", ")}` };

    const unavailable = products.filter((product) => product.status !== "di_gudang");
    if (unavailable.length) {
      return { invalid: `Barang tidak lagi tersedia di gudang: ${unavailable.map((product) => `${product.barcode} (${product.status})`).join(", ")}` };
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
        fromStatus: "di_gudang",
        toStatus,
        branch: product.branchRecord?.name ?? "—",
      },
    });
  }
  res.json({ count: result.products.length, products: result.products.map(publicProduct) });
}

async function getProduct(req, res) {
  const branchId = assignedBranchId(req);
  const product = await Product.findOne({
    where: { id: req.params.id, ...(branchId === null ? {} : { branchId }) },
    include: productIncludes(),
  });
  if (!product) return res.status(404).json({ error: "Produk tidak ditemukan." });
  const pagination = paginationFromQuery(req.query);
  const activityOptions = {
    where: {
      [Op.or]: [
        { entityId: product.barcode },
        sequelize.where(sequelize.json("details.barcode"), product.barcode),
      ],
    },
    order: [["createdAt", "DESC"]],
  };
  const activityResult = pagination
    ? await ActivityLog.findAndCountAll({
      ...activityOptions,
      limit: pagination.limit,
      offset: pagination.offset,
    })
    : { rows: await ActivityLog.findAll(activityOptions), count: null };
  const payload = {
    product: publicProduct(product),
    activityLogs: activityResult.rows.map((log) => ({
      id: log.id,
      username: log.username,
      action: log.action,
      createdAt: log.createdAt,
    })),
  };
  if (pagination) payload.activityPagination = paginationMetadata(pagination, activityResult.count);
  res.json(payload);
}

async function updateSoldProductStatus(req, res) {
  const toStatus = req.body?.status;
  if (typeof toStatus !== "string" || !STATUSES.has(toStatus) || toStatus === "terjual") {
    return res.status(400).json({ error: "Status tujuan tidak valid." });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const product = await Product.findByPk(req.params.id, {
      include: productIncludes(),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) return { notFound: true };
    if (product.status !== "terjual") return { invalidStatus: true };

    const fromStatus = product.status;
    if (toStatus === "di_toko" && product.storeId && product.variantId) {
      const [stock] = await StoreStock.findOrCreate({
        where: { storeId: product.storeId, variantId: product.variantId },
        defaults: { totalStock: 0, updatedBy: req.user?.id ?? null },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      stock.totalStock += 1;
      stock.updatedBy = req.user?.id ?? null;
      await stock.save({ transaction });
    }

    product.status = toStatus;
    await product.save({ transaction });
    return { product, fromStatus };
  });

  if (result.notFound) return res.status(404).json({ error: "Produk tidak ditemukan." });
  if (result.invalidStatus) return res.status(409).json({ error: "Status produk sudah berubah. Muat ulang laporan." });

  await logActivity(req, {
    action: "update",
    entityType: "product",
    entityId: result.product.id,
    details: {
      barcode: result.product.barcode,
      variantId: result.product.variantId,
      variantName: result.product.variantRecord?.name ?? null,
      fromStatus: result.fromStatus,
      toStatus,
      branch: result.product.branchRecord?.name ?? "—",
    },
  });
  res.json({ product: publicProduct(result.product) });
}

async function deleteProduct(req, res) {
  const branchId = assignedBranchId(req);
  const product = await Product.findOne({
    where: { id: req.params.id, ...(branchId === null ? {} : { branchId }) },
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

module.exports = {
  deleteProduct,
  generateProducts,
  getProduct,
  updateSoldProductStatus,
  getOperationalDashboardSummary,
  listPickupProducts,
  listProductBranches,
  listProducts,
  moveWarehouseProducts,
  pickWarehouseProducts,
};
