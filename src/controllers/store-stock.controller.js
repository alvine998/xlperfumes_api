const Store = require("../models/store");
const StoreStock = require("../models/store-stock");
const Variant = require("../models/variant");
const User = require("../models/user");
const Product = require("../models/product");
const sequelize = require("../config/database");
const logActivity = require("../middleware/activity-log");

const MAX_STORE_STOCK_PAGE_LIMIT = 100;

function publicStock(store, variant, stock) {
  return {
    id: `${store.id}:${variant.id}`,
    storeId: store.id,
    name: store.name,
    branch: store.branch,
    variantId: variant.id,
    variantName: variant.name,
    variantQuantity: Number(variant.quantity),
    variantUnit: variant.unit,
    totalStock: stock ? Number(stock.totalStock) : 0,
    lastUpdate: stock ? stock.updatedAt : null,
    updatedBy: stock?.updater
      ? { id: stock.updater.id, username: stock.updater.username }
      : null,
  };
}

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, max)
    : fallback;
}

function validDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function listStoreStock(req, res) {
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  if (startDate !== undefined && !validDateOnly(startDate)) {
    return res.status(400).json({ error: "Tanggal mulai tidak valid." });
  }
  if (endDate !== undefined && !validDateOnly(endDate)) {
    return res.status(400).json({ error: "Tanggal akhir tidak valid." });
  }
  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({ error: "Rentang tanggal tidak valid." });
  }

  const [stores, variants, stocks] = await Promise.all([
    Store.findAll({ order: [["createdAt", "DESC"]] }),
    Variant.findAll({ order: [["createdAt", "DESC"]] }),
    StoreStock.findAll({
      include: [{ model: User, as: "updater", attributes: ["id", "username"] }],
    }),
  ]);
  const stockByPair = new Map(
    stocks.map((stock) => [`${stock.storeId}:${stock.variantId}`, stock]),
  );
  const rows = stores.flatMap((store) =>
    variants.filter((variant) => !store.branchId || !variant.branchId || store.branchId === variant.branchId).map((variant) => {
      const stock = stockByPair.get(`${store.id}:${variant.id}`);
      return publicStock(store, variant, stock);
    }),
  );

  const page = positiveInteger(req.query.page, 1);
  const limit = positiveInteger(req.query.limit, 10, MAX_STORE_STOCK_PAGE_LIMIT);
  const search = typeof req.query.search === "string"
    ? req.query.search.trim().toLocaleLowerCase("id-ID")
    : "";
  const branch = typeof req.query.branch === "string" ? req.query.branch.trim() : "";
  const sortOrder = req.query.sortOrder === "oldest" ? "oldest" : "newest";
  const startTimestamp = startDate
    ? new Date(`${startDate}T00:00:00.000+07:00`).getTime()
    : -Infinity;
  const endTimestamp = endDate
    ? new Date(`${endDate}T23:59:59.999+07:00`).getTime()
    : Infinity;

  const rowsByStore = new Map();
  const summaries = new Map();
  for (const row of rows) {
    const storeRows = rowsByStore.get(row.storeId) ?? [];
    storeRows.push(row);
    rowsByStore.set(row.storeId, storeRows);

    const summary = summaries.get(row.storeId) ?? {
      storeId: row.storeId,
      name: row.name,
      branch: row.branch,
      lastUpdate: null,
    };
    if (
      row.lastUpdate &&
      (!summary.lastUpdate || new Date(row.lastUpdate) > new Date(summary.lastUpdate))
    ) {
      summary.lastUpdate = row.lastUpdate;
    }
    summaries.set(row.storeId, summary);
  }

  const allSummaries = [...summaries.values()];
  const filteredSummaries = allSummaries
    .filter((store) => {
      const updated = store.lastUpdate ? new Date(store.lastUpdate).getTime() : null;
      return (
        (!search || store.name.toLocaleLowerCase("id-ID").includes(search)) &&
        (!branch || branch === "all" || store.branch === branch) &&
        ((startTimestamp === -Infinity && endTimestamp === Infinity) ||
          (updated !== null && updated >= startTimestamp && updated <= endTimestamp))
      );
    })
    .sort((a, b) => {
      if (!a.lastUpdate) return b.lastUpdate ? 1 : 0;
      if (!b.lastUpdate) return -1;
      const delta = new Date(a.lastUpdate).getTime() - new Date(b.lastUpdate).getTime();
      return sortOrder === "newest" ? -delta : delta;
    });

  const total = filteredSummaries.length;
  const totalPages = Math.ceil(total / limit);
  const currentPage = Math.min(page, Math.max(1, totalPages));
  const firstStoreIndex = (currentPage - 1) * limit;
  const pageSummaries = filteredSummaries.slice(firstStoreIndex, firstStoreIndex + limit);
  const pageRows = pageSummaries.flatMap((store) => rowsByStore.get(store.storeId) ?? []);
  const branches = [...new Set(allSummaries.map((store) => store.branch))].sort((a, b) =>
    a.localeCompare(b, "id-ID"),
  );

  res.json({
    stocks: pageRows,
    branches,
    pagination: { page: currentPage, limit, total, totalPages },
  });
}

async function adjustStoreStock(req, res) {
  const storeId = Number(req.params.storeId);
  const variantId = Number(req.params.variantId);
  const direction = req.body?.direction;
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(storeId) || storeId < 1 ||
    !Number.isInteger(variantId) || variantId < 1 ||
    (direction !== "increase" && direction !== "decrease") ||
    !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "Toko, varian, arah penyesuaian, dan jumlah unit yang valid wajib diisi." });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const [store, variant] = await Promise.all([
      Store.findByPk(storeId, { transaction }),
      Variant.findByPk(variantId, { transaction }),
    ]);
    if (!store || !variant) return null;
    if (store.branchId && variant.branchId && store.branchId !== variant.branchId) {
      return { variantBranchMismatch: true };
    }

    const [stock] = await StoreStock.findOrCreate({
      where: { storeId, variantId },
      defaults: { storeId, variantId, totalStock: 0 },
      transaction,
    });

    const delta = direction === "increase" ? quantity : -quantity;
    const nextStock = Number(stock.totalStock) + delta;
    if (nextStock < 0) return { insufficient: true };
    if (nextStock > 4294967295) return { overflow: true };

    stock.totalStock = nextStock;
    stock.updatedBy = req.user.id;
    await stock.save({ transaction });
    return { store, variant, stock };
  });

  if (!result) return res.status(404).json({ error: "Toko atau varian tidak ditemukan." });
  if (result.variantBranchMismatch) return res.status(400).json({ error: "Varian bukan milik cabang toko ini." });
  if (result.insufficient) return res.status(400).json({ error: "Jumlah pengurangan melebihi stok yang tersedia." });
  if (result.overflow) return res.status(400).json({ error: "Jumlah stok melebihi batas maksimum." });

  await logActivity(req, {
    action: "update",
    entityType: "store_stock",
    entityId: `${result.store.id}:${result.variant.id}`,
    details: {
      name: result.store.name,
      branch: result.store.branch,
      variantId: result.variant.id,
      variantName: result.variant.name,
      direction,
      quantity,
      totalStock: result.stock.totalStock,
      updatedBy: req.user.username,
    },
  });
  const updatedStock = await StoreStock.findByPk(result.stock.id, {
    include: [{ model: User, as: "updater", attributes: ["id", "username"] }],
  });
  res.json({ stock: publicStock(result.store, result.variant, updatedStock) });
}

async function receiveStoreStock(req, res) {
  const storeId = Number(req.params.storeId);
  const items = req.body?.items;
  if (!Number.isInteger(storeId) || storeId < 1 || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Pilih toko dan isi jumlah stok yang akan ditambahkan." });
  }
  const seenVariants = new Set();
  for (const item of items) {
    if (!item || !Number.isInteger(Number(item.variantId)) || Number(item.variantId) < 1 ||
      !Number.isInteger(Number(item.quantity)) || Number(item.quantity) < 1 ||
      (item.notes !== undefined && (typeof item.notes !== "string" || item.notes.trim().length > 500))) {
      return res.status(400).json({ error: "Varian, jumlah pcs, atau keterangan tidak valid." });
    }
    if (seenVariants.has(Number(item.variantId))) {
      return res.status(400).json({ error: "Setiap varian hanya boleh dikirim satu kali." });
    }
    seenVariants.add(Number(item.variantId));
  }

  const result = await sequelize.transaction(async (transaction) => {
    const store = await Store.findByPk(storeId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!store) return { notFound: true };
    const variants = await Variant.findAll({
      where: { id: [...seenVariants] },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (variants.length !== seenVariants.size) return { variantNotFound: true };
    const variantById = new Map(variants.map((variant) => [variant.id, variant]));
    const mismatchedVariant = variants.find((variant) =>
      store.branchId && variant.branchId && store.branchId !== variant.branchId,
    );
    if (mismatchedVariant) {
      return { variantBranchMismatch: true, variantName: mismatchedVariant.name };
    }

    const updated = [];
    for (const item of items) {
      const variantId = Number(item.variantId);
      const quantity = Number(item.quantity);
      const variant = variantById.get(variantId);
      if (!variant) return { variantNotFound: true };

      const productWhere = { variantId, status: "di_gudang" };
      if (store.branchId) productWhere.branchId = store.branchId;
      const products = await Product.findAll({
        where: productWhere,
        order: [["id", "ASC"]],
        limit: quantity,
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (products.length < quantity) {
        return { insufficientWarehouse: true, variantName: variant.name, available: products.length };
      }

      const stock = await StoreStock.findOne({
        where: { storeId, variantId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      }) || await StoreStock.create({ storeId, variantId, totalStock: 0 }, { transaction });
      const nextStock = Number(stock.totalStock) + quantity;
      if (nextStock > 4294967295) return { overflow: true, variantName: variant.name };

      stock.totalStock = nextStock;
      stock.updatedBy = req.user.id;
      await stock.save({ transaction });
      await Product.update(
        { status: "di_toko" },
        { where: { id: products.map((product) => product.id) }, transaction },
      );
      updated.push({ store, variant, stock, quantity, notes: item.notes?.trim() || "Dari Gudang" });
    }
    return { updated };
  });

  if (result.notFound) return res.status(404).json({ error: "Toko tidak ditemukan." });
  if (result.variantNotFound) return res.status(404).json({ error: "Varian tidak ditemukan." });
  if (result.variantBranchMismatch) {
    return res.status(400).json({ error: `Varian ${result.variantName} bukan milik cabang toko ini.` });
  }
  if (result.insufficientWarehouse) {
    if (result.available === 0) {
      return res.status(400).json({ error: `Tidak ada produk ${result.variantName} berstatus Di Gudang.` });
    }
    return res.status(400).json({ error: `Stok gudang untuk ${result.variantName} tidak mencukupi. Tersedia ${result.available} pcs.` });
  }
  if (result.overflow) return res.status(400).json({ error: `Jumlah stok ${result.variantName} melebihi batas maksimum.` });

  for (const entry of result.updated) {
    await logActivity(req, {
      action: "update",
      entityType: "store_stock",
      entityId: `${entry.store.id}:${entry.variant.id}`,
      details: {
        name: entry.store.name,
        branch: entry.store.branch,
        variantId: entry.variant.id,
        variantName: entry.variant.name,
        direction: "increase",
        quantity: entry.quantity,
        notes: entry.notes,
        totalStock: entry.stock.totalStock,
        updatedBy: req.user.username,
      },
    });
  }
  const stocks = await Promise.all(result.updated.map(async (entry) => {
    const stock = await StoreStock.findByPk(entry.stock.id, {
      include: [{ model: User, as: "updater", attributes: ["id", "username"] }],
    });
    return publicStock(entry.store, entry.variant, stock);
  }));
  res.json({ stocks });
}

module.exports = { listStoreStock, adjustStoreStock, receiveStoreStock };
