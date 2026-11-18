const Store = require("../models/store");
const Branch = require("../models/branch");
const logActivity = require("../middleware/activity-log");

function publicStore(store) {
  return {
    id: store.id,
    name: store.name,
    branch: store.branchRecord?.name ?? store.branch,
    branchId: store.branchId ?? null,
    address: store.address,
    latitude: Number(store.latitude),
    longitude: Number(store.longitude),
    createdAt: store.createdAt,
  };
}

function validStoreDetails(body, branchName) {
  return typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 120 &&
    typeof branchName === "string" && branchName.trim().length > 0 && branchName.trim().length <= 100 &&
    typeof body.address === "string" && body.address.trim().length > 0 &&
    Number.isFinite(Number(body.latitude)) && Number(body.latitude) >= -90 && Number(body.latitude) <= 90 &&
    Number.isFinite(Number(body.longitude)) && Number(body.longitude) >= -180 && Number(body.longitude) <= 180;
}

async function listStores(_req, res) {
  const stores = await Store.findAll({
    include: [{ model: Branch, as: "branchRecord", attributes: ["id", "name"] }],
    order: [["createdAt", "DESC"]],
  });
  res.json({ stores: stores.map(publicStore) });
}

async function createStore(req, res) {
  const body = req.body ?? {};
  let branch = null;
  if (body.branchId !== undefined && body.branchId !== null) {
    const branchId = Number(body.branchId);
    if (!Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Cabang tidak valid." });
    }
    branch = await Branch.findByPk(branchId);
    if (!branch) return res.status(400).json({ error: "Cabang tidak ditemukan." });
  }
  const branchName = branch?.name ?? body.branch;
  if (!validStoreDetails(body, branchName)) {
    return res.status(400).json({ error: "Nama toko, cabang, alamat, dan pin lokasi yang valid wajib diisi." });
  }

  const store = await Store.create({
    name: body.name.trim(),
    branch: branchName.trim(),
    branchId: branch?.id ?? null,
    address: body.address.trim(),
    latitude: Number(body.latitude),
    longitude: Number(body.longitude),
  });
  await logActivity(req, {
    action: "create",
    entityType: "store",
    entityId: store.id,
    details: { name: store.name, branch: store.branch },
  });
  res.status(201).json({ store: publicStore(store) });
}

async function updateStore(req, res) {
  const store = await Store.findByPk(req.params.id);
  if (!store) return res.status(404).json({ error: "Toko tidak ditemukan." });

  const body = req.body ?? {};
  const allowedFields = ["name", "branch", "branchId", "address", "latitude", "longitude"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ error: "Data toko atau pin lokasi tidak valid." });
  }

  const updated = { ...store.toJSON(), ...body };
  let branch = null;
  if (updated.branchId !== undefined && updated.branchId !== null) {
    const branchId = Number(updated.branchId);
    if (!Number.isInteger(branchId) || branchId < 1) {
      return res.status(400).json({ error: "Cabang tidak valid." });
    }
    branch = await Branch.findByPk(branchId);
    if (!branch) return res.status(400).json({ error: "Cabang tidak ditemukan." });
  }
  const branchName = branch?.name ?? updated.branch;
  if (!validStoreDetails(updated, branchName)) {
    return res.status(400).json({ error: "Data toko atau pin lokasi tidak valid." });
  }

  store.name = updated.name.trim();
  store.branch = branchName.trim();
  store.branchId = branch?.id ?? null;
  store.address = updated.address.trim();
  store.latitude = Number(updated.latitude);
  store.longitude = Number(updated.longitude);
  await store.save();
  await logActivity(req, {
    action: "update",
    entityType: "store",
    entityId: store.id,
    details: { changedFields: Object.keys(body), name: store.name, branch: store.branch },
  });
  res.json({ store: publicStore(store) });
}

async function deleteStore(req, res) {
  const store = await Store.findByPk(req.params.id);
  if (!store) return res.status(404).json({ error: "Toko tidak ditemukan." });
  const deletedStore = { id: store.id, name: store.name, branch: store.branch };
  await store.destroy();
  await logActivity(req, {
    action: "delete",
    entityType: "store",
    entityId: deletedStore.id,
    details: deletedStore,
  });
  res.status(204).end();
}

module.exports = { listStores, createStore, updateStore, deleteStore };
