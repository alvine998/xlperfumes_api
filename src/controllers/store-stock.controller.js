const Store = require("../models/store");
const StoreStock = require("../models/store-stock");
const sequelize = require("../config/database");
const logActivity = require("../middleware/activity-log");

function publicStock(store, stock) {
  return {
    id: store.id,
    name: store.name,
    branch: store.branch,
    totalStock: stock ? Number(stock.totalStock) : 0,
    lastUpdate: stock ? stock.updatedAt : store.updatedAt,
  };
}

async function listStoreStock(_req, res) {
  const stores = await Store.findAll({ order: [["createdAt", "DESC"]] });
  const stocks = await StoreStock.findAll({
    where: { storeId: stores.map((store) => store.id) },
  });
  const stockByStoreId = new Map(stocks.map((stock) => [stock.storeId, stock]));
  res.json({
    stocks: stores.map((store) => publicStock(store, stockByStoreId.get(store.id))),
  });
}

async function adjustStoreStock(req, res) {
  const storeId = Number(req.params.storeId);
  const direction = req.body?.direction;
  const quantity = Number(req.body?.quantity);

  if (!Number.isInteger(storeId) || storeId < 1 ||
    (direction !== "increase" && direction !== "decrease") ||
    !Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: "Toko, arah penyesuaian, dan jumlah unit yang valid wajib diisi." });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const store = await Store.findByPk(storeId, { transaction });
    if (!store) return null;

    const [stock] = await StoreStock.findOrCreate({
      where: { storeId },
      defaults: { storeId, totalStock: 0 },
      transaction,
    });

    const delta = direction === "increase" ? quantity : -quantity;
    const nextStock = Number(stock.totalStock) + delta;
    if (nextStock < 0) return { insufficient: true };

    stock.totalStock = nextStock;
    await stock.save({ transaction });
    return { store, stock };
  });

  if (!result) return res.status(404).json({ error: "Toko tidak ditemukan." });
  if (result.insufficient) return res.status(400).json({ error: "Jumlah pengurangan melebihi stok yang tersedia." });

  await logActivity(req, {
    action: "update",
    entityType: "store_stock",
    entityId: result.store.id,
    details: {
      name: result.store.name,
      branch: result.store.branch,
      direction,
      quantity,
      totalStock: result.stock.totalStock,
    },
  });
  res.json({ stock: publicStock(result.store, result.stock) });
}

module.exports = { listStoreStock, adjustStoreStock };
