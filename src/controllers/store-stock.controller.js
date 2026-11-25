const { Op } = require("sequelize");
const Store = require("../models/store");
const StoreStock = require("../models/store-stock");
const Variant = require("../models/variant");
const User = require("../models/user");
const Product = require("../models/product");
const sequelize = require("../config/database");
const logActivity = require("../middleware/activity-log");
const { assignedBranchId } = require("../utils/user-branch");

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

function publicVisitProduct(product) {
  return {
    id: product.id,
    barcode: product.barcode,
    storeId: product.storeId ?? null,
    variantId: product.variantId,
    variantName: product.variantRecord?.name ?? null,
    status: product.status,
  };
}

function productIncludes() {
  return [{ model: Variant, as: "variantRecord", attributes: ["id", "name", "branchId"] }];
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

  const assignedId = assignedBranchId(req);
  const [stores, variants, stocks] = await Promise.all([
    Store.findAll({
      where: assignedId === null ? {} : { branchId: assignedId },
      order: [["createdAt", "DESC"]],
    }),
    Variant.findAll({
      where: assignedId === null ? {} : { branchId: assignedId },
      order: [["createdAt", "DESC"]],
    }),
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
  const branch = assignedId !== null
    ? ""
    : typeof req.query.branch === "string" ? req.query.branch.trim() : "";
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

async function getVisitStoreStock(req, res) {
  const storeId = Number(req.params.storeId);
  if (!Number.isSafeInteger(storeId) || storeId < 1) {
    return res.status(400).json({ error: "Toko tidak valid." });
  }

  const assignedId = assignedBranchId(req);
  const store = await Store.findOne({
    where: { id: storeId, ...(assignedId === null ? {} : { branchId: assignedId }) },
  });
  if (!store) return res.status(404).json({ error: "Toko tidak ditemukan." });

  const [variants, stocks, products] = await Promise.all([
    Variant.findAll({
      where: store.branchId === null ? {} : { branchId: store.branchId },
      order: [["name", "ASC"]],
    }),
    StoreStock.findAll({
      where: { storeId },
      include: [{ model: User, as: "updater", attributes: ["id", "username"] }],
    }),
    Product.findAll({
      where: { storeId, status: "di_toko" },
      include: productIncludes(),
      order: [["updatedAt", "DESC"], ["id", "DESC"]],
    }),
  ]);
  const stockByVariant = new Map(stocks.map((stock) => [stock.variantId, stock]));
  const compatibleVariants = variants.filter((variant) =>
    !store.branchId || !variant.branchId || store.branchId === variant.branchId,
  );

  res.json({
    store: { id: store.id, name: store.name, branch: store.branch },
    stocks: compatibleVariants.map((variant) =>
      publicStock(store, variant, stockByVariant.get(variant.id) ?? null),
    ),
    products: products.map(publicVisitProduct),
    canManageProducts: req.user?.role === "collecting",
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

  const assignedId = assignedBranchId(req);
  const result = await sequelize.transaction(async (transaction) => {
    const [store, variant] = await Promise.all([
      Store.findOne({
        where: { id: storeId, ...(assignedId === null ? {} : { branchId: assignedId }) },
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
      Variant.findOne({
        where: { id: variantId, ...(assignedId === null ? {} : { branchId: assignedId }) },
        transaction,
        lock: transaction.LOCK.UPDATE,
      }),
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
    if (direction === "decrease") {
      const linkedProducts = await Product.count({
        where: { storeId, variantId, status: "di_toko" },
        transaction,
      });
      if (nextStock < linkedProducts) return { linkedProductsExceed: true, linkedProducts };
    }

    stock.totalStock = nextStock;
    stock.updatedBy = req.user.id;
    await stock.save({ transaction });
    return { store, variant, stock };
  });

  if (!result) return res.status(404).json({ error: "Toko atau varian tidak ditemukan." });
  if (result.variantBranchMismatch) return res.status(400).json({ error: "Varian bukan milik cabang toko ini." });
  if (result.insufficient) return res.status(400).json({ error: "Jumlah pengurangan melebihi stok yang tersedia." });
  if (result.overflow) return res.status(400).json({ error: "Jumlah stok melebihi batas maksimum." });
  if (result.linkedProductsExceed) {
    return res.status(400).json({ error: `Stok tidak dapat dikurangi di bawah jumlah produk berbarcode yang tercatat (${result.linkedProducts} pcs).` });
  }

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

  const assignedId = assignedBranchId(req);
  const result = await sequelize.transaction(async (transaction) => {
    const store = await Store.findOne({
      where: { id: storeId, ...(assignedId === null ? {} : { branchId: assignedId }) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!store) return { notFound: true };
    const variants = await Variant.findAll({
      where: {
        id: [...seenVariants],
        ...(assignedId === null ? {} : { branchId: assignedId }),
      },
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
        { status: "di_toko", storeId: store.id },
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

async function receiveVisitProducts(req, res) {
  const storeId = Number(req.params.storeId);
  const barcodes = req.body?.barcodes;
  if (!Number.isSafeInteger(storeId) || storeId < 1 || !Array.isArray(barcodes) ||
    barcodes.length === 0 || barcodes.length > 500 ||
    barcodes.some((barcode) => typeof barcode !== "string" || !barcode.trim() || barcode.length > 120)) {
    return res.status(400).json({ error: "Daftar kode QR yang valid wajib diisi (maksimal 500 produk)." });
  }
  const normalized = barcodes.map((barcode) => barcode.trim());
  if (new Set(normalized).size !== normalized.length) {
    return res.status(400).json({ error: "Kode QR yang sama tidak boleh dimasukkan lebih dari sekali." });
  }

  const assignedId = assignedBranchId(req);
  const result = await sequelize.transaction(async (transaction) => {
    const store = await Store.findOne({
      where: { id: storeId, ...(assignedId === null ? {} : { branchId: assignedId }) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!store) return { notFound: true };

    const products = await Product.findAll({
      where: { barcode: normalized, ...(assignedId === null ? {} : { branchId: assignedId }) },
      include: productIncludes(),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const byBarcode = new Map(products.map((product) => [product.barcode, product]));
    const missing = normalized.filter((barcode) => !byBarcode.has(barcode));
    if (missing.length) return { missing };
    const unavailable = products.filter((product) =>
      product.status !== "di_collecting" || product.storeId !== null,
    );
    if (unavailable.length) return { unavailable };
    const withoutVariant = products.find((product) => !product.variantId || !product.variantRecord);
    if (withoutVariant) return { withoutVariant };
    const outsideStoreBranch = products.find((product) =>
      store.branchId && product.branchId !== store.branchId,
    );
    if (outsideStoreBranch) return { outsideStoreBranch };
    const mismatchedVariant = products.find((product) =>
      store.branchId && product.variantRecord.branchId && product.variantRecord.branchId !== store.branchId,
    );
    if (mismatchedVariant) return { mismatchedVariant };

    const quantities = new Map();
    for (const product of products) {
      quantities.set(product.variantId, (quantities.get(product.variantId) ?? 0) + 1);
    }
    const updatedStocks = [];
    for (const [variantId, quantity] of quantities) {
      const variant = products.find((product) => product.variantId === variantId)?.variantRecord;
      if (!variant) return { withoutVariant: true };
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
      updatedStocks.push({ stock, variant, quantity });
    }

    await Product.update(
      { status: "di_toko", storeId },
      { where: { id: products.map((product) => product.id) }, transaction },
    );
    const updatedProducts = await Product.findAll({
      where: { id: products.map((product) => product.id) },
      include: productIncludes(),
      transaction,
    });
    return { store, updatedStocks, products: updatedProducts };
  });

  if (result.notFound) return res.status(404).json({ error: "Toko tidak ditemukan." });
  if (result.missing) return res.status(400).json({ error: `Kode QR tidak ditemukan: ${result.missing.join(", ")}` });
  if (result.unavailable) {
    return res.status(400).json({
      error: `Produk harus berstatus Di Collecting sebelum dimasukkan ke toko: ${result.unavailable.map((product) => `${product.barcode} (${product.status})`).join(", ")}`,
    });
  }
  if (result.withoutVariant) return res.status(400).json({ error: "Varian produk belum terhubung, sehingga stok toko tidak dapat dihitung." });
  if (result.outsideStoreBranch) return res.status(400).json({ error: "Produk berasal dari cabang yang berbeda dengan toko ini." });
  if (result.mismatchedVariant) return res.status(400).json({ error: `Varian ${result.mismatchedVariant.variantRecord.name} bukan milik cabang toko ini.` });
  if (result.overflow) return res.status(400).json({ error: `Jumlah stok ${result.variantName} melebihi batas maksimum.` });

  for (const product of result.products) {
    await logActivity(req, {
      action: "update",
      entityType: "product",
      entityId: product.id,
      details: {
        barcode: product.barcode,
        variantId: product.variantId,
        variantName: product.variantRecord?.name ?? null,
        fromStatus: "di_collecting",
        toStatus: "di_toko",
        storeId: result.store.id,
        storeName: result.store.name,
        branch: result.store.branch,
      },
    });
  }
  for (const entry of result.updatedStocks) {
    await logActivity(req, {
      action: "update",
      entityType: "store_stock",
      entityId: `${result.store.id}:${entry.variant.id}`,
      details: {
        name: result.store.name,
        branch: result.store.branch,
        variantId: entry.variant.id,
        variantName: entry.variant.name,
        direction: "increase",
        quantity: entry.quantity,
        totalStock: entry.stock.totalStock,
        updatedBy: req.user.username,
      },
    });
  }
  res.json({ products: result.products.map(publicVisitProduct) });
}

async function updateVisitProductStatus(req, res) {
  const storeId = Number(req.params.storeId);
  const barcode = typeof req.body?.barcode === "string" ? req.body.barcode.trim() : "";
  const toStatus = req.body?.status;
  if (!Number.isSafeInteger(storeId) || storeId < 1 || !barcode || barcode.length > 120 ||
    !["di_collecting", "terjual", "rusak"].includes(toStatus)) {
    return res.status(400).json({ error: "Toko, kode QR produk, dan status tujuan tidak valid." });
  }

  const assignedId = assignedBranchId(req);
  const result = await sequelize.transaction(async (transaction) => {
    const store = await Store.findOne({
      where: { id: storeId, ...(assignedId === null ? {} : { branchId: assignedId }) },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!store) return { storeNotFound: true };
    const product = await Product.findOne({
      where: {
        barcode,
        [Op.or]: [{ storeId }, { storeId: null }],
        status: "di_toko",
        ...(assignedId === null ? {} : { branchId: assignedId }),
      },
      include: productIncludes(),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) return { productNotFound: true };
    if (!product.variantId || !product.variantRecord) return { withoutVariant: true };
    if (store.branchId && product.branchId !== store.branchId) return { outsideStoreBranch: true };
    if (store.branchId && product.variantRecord.branchId && product.variantRecord.branchId !== store.branchId) {
      return { mismatchedVariant: true };
    }

    const stock = await StoreStock.findOne({
      where: { storeId, variantId: product.variantId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!stock || Number(stock.totalStock) < 1) return { stockMismatch: true };
    const variant = product.variantRecord;
    stock.totalStock = Number(stock.totalStock) - 1;
    stock.updatedBy = req.user.id;
    await stock.save({ transaction });
    product.status = toStatus;
    product.storeId = null;
    await product.save({ transaction });
    return { store, stock, variant, product };
  });

  if (result.storeNotFound) return res.status(404).json({ error: "Toko tidak ditemukan." });
  if (result.productNotFound) return res.status(404).json({ error: "Produk berstatus Di Toko tidak ditemukan pada toko ini atau tercatat di toko lain." });
  if (result.withoutVariant) return res.status(400).json({ error: "Varian produk belum terhubung, sehingga stok toko tidak dapat dikurangi." });
  if (result.outsideStoreBranch) return res.status(400).json({ error: "Produk berasal dari cabang yang berbeda dengan toko ini." });
  if (result.mismatchedVariant) return res.status(400).json({ error: "Varian produk bukan milik cabang toko ini." });
  if (result.stockMismatch) return res.status(409).json({ error: "Jumlah stok varian ini tidak sesuai dengan produk yang tercatat di toko." });

  await logActivity(req, {
    action: "update",
    entityType: "product",
    entityId: result.product.id,
    details: {
      barcode: result.product.barcode,
      variantId: result.product.variantId,
      variantName: result.variant?.name ?? null,
      fromStatus: "di_toko",
      toStatus,
      storeId: result.store.id,
      storeName: result.store.name,
      branch: result.store.branch,
    },
  });
  await logActivity(req, {
    action: "update",
    entityType: "store_stock",
    entityId: `${result.store.id}:${result.variant?.id}`,
    details: {
      name: result.store.name,
      branch: result.store.branch,
      variantId: result.variant?.id,
      variantName: result.variant?.name ?? null,
      direction: "decrease",
      quantity: 1,
      totalStock: result.stock.totalStock,
      updatedBy: req.user.username,
    },
  });
  res.json({ product: publicVisitProduct(result.product) });
}

module.exports = {
  adjustStoreStock,
  getVisitStoreStock,
  listStoreStock,
  receiveStoreStock,
  receiveVisitProducts,
  updateVisitProductStatus,
};
