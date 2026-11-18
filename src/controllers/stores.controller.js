const Store = require("../models/store");
const logActivity = require("../middleware/activity-log");

function publicStore(store) {
  return {
    id: store.id,
    name: store.name,
    branch: store.branch,
    address: store.address,
    latitude: Number(store.latitude),
    longitude: Number(store.longitude),
    createdAt: store.createdAt,
  };
}

function validStore(body) {
  return typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 120 &&
    typeof body.branch === "string" && body.branch.trim().length > 0 && body.branch.trim().length <= 100 &&
    typeof body.address === "string" && body.address.trim().length > 0 &&
    Number.isFinite(Number(body.latitude)) && Number(body.latitude) >= -90 && Number(body.latitude) <= 90 &&
    Number.isFinite(Number(body.longitude)) && Number(body.longitude) >= -180 && Number(body.longitude) <= 180;
}

async function listStores(_req, res) {
  const stores = await Store.findAll({ order: [["createdAt", "DESC"]] });
  res.json({ stores: stores.map(publicStore) });
}

async function createStore(req, res) {
  const body = req.body ?? {};
  if (!validStore(body)) {
    return res.status(400).json({ error: "Nama toko, cabang, alamat, dan pin lokasi yang valid wajib diisi." });
  }

  const store = await Store.create({
    name: body.name.trim(),
    branch: body.branch.trim(),
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
  const allowedFields = ["name", "branch", "address", "latitude", "longitude"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field)) || !validStore({ ...store.toJSON(), ...body })) {
    return res.status(400).json({ error: "Data toko atau pin lokasi tidak valid." });
  }

  const updated = { ...store.toJSON(), ...body };
  store.name = updated.name.trim();
  store.branch = updated.branch.trim();
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
