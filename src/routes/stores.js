const express = require("express");
const Store = require("../models/store");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requireAdmin } = require("../middleware/authenticate");

const router = express.Router();

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

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(async (_req, res) => {
  const stores = await Store.findAll({ order: [["createdAt", "DESC"]] });
  res.json({ stores: stores.map(publicStore) });
}));

router.post("/", asyncHandler(async (req, res) => {
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
  res.status(201).json({ store: publicStore(store) });
}));

router.patch("/:id", asyncHandler(async (req, res) => {
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
  res.json({ store: publicStore(store) });
}));

router.delete("/:id", asyncHandler(async (req, res) => {
  const store = await Store.findByPk(req.params.id);
  if (!store) return res.status(404).json({ error: "Toko tidak ditemukan." });
  await store.destroy();
  res.status(204).end();
}));

module.exports = router;
