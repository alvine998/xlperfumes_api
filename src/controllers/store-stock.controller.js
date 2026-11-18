const Store = require("../models/store");
const StoreStock = require("../models/store-stock");
const Variant = require("../models/variant");
const User = require("../models/user");
const sequelize = require("../config/database");
const logActivity = require("../middleware/activity-log");

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

async function listStoreStock(_req, res) {
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
    variants.map((variant) => {
      const stock = stockByPair.get(`${store.id}:${variant.id}`);
      return publicStock(store, variant, stock);
    }),
  );
  res.json({ stocks: rows });
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

module.exports = { listStoreStock, adjustStoreStock };
