const Store = require("../models/store");
const Branch = require("../models/branch");
const Zone = require("../models/zone");
const StoreZona = require("../models/store-zona");
const logActivity = require("../middleware/activity-log");
const { Op } = require("sequelize");
const { paginationFromQuery, paginationMetadata } = require("../utils/pagination");
const { assignedBranchId } = require("../utils/user-branch");

function publicStore(store, assignment = null) {
  return {
    id: store.id,
    name: store.name,
    branch: store.branchRecord?.name ?? store.branch,
    branchId: store.branchId ?? null,
    zonaId: assignment?.zonaId ?? null,
    zona: assignment?.zone?.name ?? null,
    routeIndex: assignment?.routeIndex ?? null,
    address: store.address,
    latitude: Number(store.latitude),
    longitude: Number(store.longitude),
    createdAt: store.createdAt,
  };
}

async function assignmentsByStoreId(storeIds) {
  if (storeIds.length === 0) return new Map();
  const assignments = await StoreZona.findAll({
    where: { storeId: storeIds },
    include: [{ model: Zone, as: "zone", attributes: ["id", "name"] }],
  });
  return new Map(assignments.map((assignment) => [assignment.storeId, assignment]));
}

function validStoreDetails(body, branchName) {
  return typeof body.name === "string" && body.name.trim().length > 0 && body.name.trim().length <= 120 &&
    typeof branchName === "string" && branchName.trim().length > 0 && branchName.trim().length <= 100 &&
    typeof body.address === "string" && body.address.trim().length > 0 &&
    Number.isFinite(Number(body.latitude)) && Number(body.latitude) >= -90 && Number(body.latitude) <= 90 &&
    Number.isFinite(Number(body.longitude)) && Number(body.longitude) >= -180 && Number(body.longitude) <= 180;
}

function validJakartaDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

async function listStores(req, res) {
  const {
    start_date: startDate,
    end_date: endDate,
    store_name: storeName,
    branch,
    sortOrder,
  } = req.query;
  const pagination = paginationFromQuery(req.query);
  const where = {};
  const assignedId = assignedBranchId(req);
  if (typeof storeName === "string" && storeName.trim()) {
    const search = storeName.trim().replace(/[\\%_]/g, "\\$&");
    where.name = { [Op.like]: `%${search}%` };
  }
  if (assignedId !== null) {
    where.branchId = assignedId;
  } else if (typeof branch === "string" && branch.trim() && branch !== "all") {
    where.branch = branch.trim();
  }
  if (startDate || endDate) {
    const createdAt = {};
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00.000+07:00`);
      if (!validJakartaDate(startDate)) return res.status(400).json({ error: "Tanggal awal tidak valid." });
      createdAt[Op.gte] = start;
    }
    if (endDate) {
      const end = new Date(`${endDate}T00:00:00.000+07:00`);
      if (!validJakartaDate(endDate)) return res.status(400).json({ error: "Tanggal akhir tidak valid." });
      if (startDate && startDate > endDate) return res.status(400).json({ error: "Rentang tanggal tidak valid." });
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt[Op.lt] = end;
    }
    where.createdAt = createdAt;
  }
  const options = {
    where,
    include: [
      { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
    ],
    order: [["createdAt", sortOrder === "oldest" ? "ASC" : "DESC"]],
  };
  const { rows: stores, count } = await Store.findAndCountAll({
    ...options,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  const assignments = await assignmentsByStoreId(stores.map(({ id }) => id));
  const payload = {
    stores: stores.map((store) =>
      publicStore(store, assignments.get(store.id) ?? null),
    ),
  };
  payload.pagination = paginationMetadata(pagination, count);
  res.json(payload);
}

async function createStore(req, res) {
  const body = req.body ?? {};
  const allowedFields = ["name", "branch", "branchId", "address", "latitude", "longitude"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({
      error: "Penempatan toko ke zona hanya dapat diatur dari detail zona.",
    });
  }
  const assignedId = assignedBranchId(req);
  let branch = null;
  const selectedBranchId = assignedId ?? (body.branchId === undefined || body.branchId === null
    ? null
    : Number(body.branchId));
  if (selectedBranchId !== null) {
    const branchId = selectedBranchId;
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
  store.branchRecord = branch;
  await logActivity(req, {
    action: "create",
    entityType: "store",
    entityId: store.id,
    details: { name: store.name, branch: store.branch },
  });
  res.status(201).json({ store: publicStore(store) });
}

async function updateStore(req, res) {
  const assignedId = assignedBranchId(req);
  const store = await Store.findOne({
    where: { id: req.params.id, ...(assignedId === null ? {} : { branchId: assignedId }) },
    include: [
      { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
    ],
  });
  if (!store) return res.status(404).json({ error: "Toko tidak ditemukan." });

  const body = req.body ?? {};
  const allowedFields = ["name", "branch", "branchId", "address", "latitude", "longitude"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ error: "Data toko atau pin lokasi tidak valid." });
  }

  const updated = {
    ...store.toJSON(),
    ...body,
    ...(assignedId === null ? {} : { branchId: assignedId }),
  };
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

  const assignment = await StoreZona.findByPk(store.id, {
    include: [{ model: Zone, as: "zone", attributes: ["id", "branchId"] }],
  });
  if (assignment && assignment.zone.branchId !== branch?.id) {
    return res.status(409).json({
      error: "Keluarkan toko dari zona sebelum mengubah cabangnya.",
    });
  }
  store.name = updated.name.trim();
  store.branch = branchName.trim();
  store.branchId = branch?.id ?? null;
  store.address = updated.address.trim();
  store.latitude = Number(updated.latitude);
  store.longitude = Number(updated.longitude);
  await store.save();
  store.branchRecord = branch;
  const assignments = await assignmentsByStoreId([store.id]);
  await logActivity(req, {
    action: "update",
    entityType: "store",
    entityId: store.id,
    details: { changedFields: Object.keys(body), name: store.name, branch: store.branch },
  });
  res.json({ store: publicStore(store, assignments.get(store.id) ?? null) });
}

async function deleteStore(req, res) {
  const assignedId = assignedBranchId(req);
  const store = await Store.findOne({
    where: { id: req.params.id, ...(assignedId === null ? {} : { branchId: assignedId }) },
  });
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
