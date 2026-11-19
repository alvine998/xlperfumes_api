const { Op, col, fn } = require("sequelize");
const sequelize = require("../config/database");
const Zone = require("../models/zone");
const Branch = require("../models/branch");
const Store = require("../models/store");
const User = require("../models/user");
const logActivity = require("../middleware/activity-log");

function publicZone(zone, storeCount = 0, createdBy = zone.creator?.username ?? null) {
  return {
    id: zone.id,
    name: zone.name,
    branchId: zone.branchId,
    branch: zone.branchRecord?.name ?? null,
    createdBy,
    createdAt: zone.createdAt,
    storeCount,
  };
}

function isValidDetails(body) {
  const branchId = Number(body.branchId);
  return typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 120 &&
    Number.isInteger(branchId) &&
    branchId > 0;
}

async function listZones(_req, res) {
  const [zones, storeCounts] = await Promise.all([
    Zone.findAll({
      include: [
        { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
        { model: User, as: "creator", attributes: ["id", "username"] },
      ],
      order: [["createdAt", "DESC"]],
    }),
    Store.findAll({
      attributes: ["zonaId", [fn("COUNT", col("id")), "storeCount"]],
      where: { zonaId: { [Op.not]: null } },
      group: ["zonaId"],
      raw: true,
    }),
  ]);
  const countsByZone = new Map(
    storeCounts.map((entry) => [Number(entry.zonaId), Number(entry.storeCount)]),
  );
  res.json({
    zones: zones.map((zone) =>
      publicZone(zone, countsByZone.get(zone.id) ?? 0),
    ),
  });
}

async function createZone(req, res) {
  const body = req.body ?? {};
  const allowedFields = ["name", "branchId"];
  if (
    Object.keys(body).some((field) => !allowedFields.includes(field)) ||
    !isValidDetails(body)
  ) {
    return res.status(400).json({ error: "Nama zona dan cabang yang valid wajib diisi." });
  }

  const branch = await Branch.findByPk(Number(body.branchId));
  if (!branch) return res.status(400).json({ error: "Cabang tidak ditemukan." });

  const zone = await Zone.create({
    name: body.name.trim(),
    branchId: branch.id,
    createdBy: req.user.id,
  });
  zone.branchRecord = branch;
  await logActivity(req, {
    action: "create",
    entityType: "zone",
    entityId: zone.id,
    details: { name: zone.name, branch: branch.name },
  });
  res.status(201).json({ zone: publicZone(zone, 0, req.user.username) });
}

async function updateZone(req, res) {
  const body = req.body ?? {};
  const result = await sequelize.transaction(async (transaction) => {
    const zone = await Zone.findByPk(req.params.id, {
      include: [
        { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
        { model: User, as: "creator", attributes: ["id", "username"] },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!zone) return { status: 404, error: "Zona tidak ditemukan." };

    const storeCount = await Store.count({
      where: { zonaId: zone.id },
      transaction,
    });
    if (storeCount > 0) {
      return {
        status: 409,
        error: "Zona tidak dapat diubah karena masih digunakan oleh toko.",
      };
    }

    const allowedFields = ["name", "branchId"];
    const updated = { ...zone.toJSON(), ...body };
    if (
      Object.keys(body).some((field) => !allowedFields.includes(field)) ||
      !isValidDetails(updated)
    ) {
      return { status: 400, error: "Data zona tidak valid." };
    }

    const branch = await Branch.findByPk(Number(updated.branchId), { transaction });
    if (!branch) return { status: 400, error: "Cabang tidak ditemukan." };

    zone.name = updated.name.trim();
    zone.branchId = branch.id;
    await zone.save({ transaction });
    zone.branchRecord = branch;
    return { zone, changedFields: Object.keys(body), branch };
  });
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  const { zone, changedFields, branch } = result;
  await logActivity(req, {
    action: "update",
    entityType: "zone",
    entityId: zone.id,
    details: { changedFields, name: zone.name, branch: branch.name },
  });
  res.json({ zone: publicZone(zone) });
}

async function deleteZone(req, res) {
  const zone = await Zone.findByPk(req.params.id);
  if (!zone) return res.status(404).json({ error: "Zona tidak ditemukan." });

  const storeCount = await Store.count({ where: { zonaId: zone.id } });
  if (storeCount > 0) {
    return res.status(409).json({
      error: "Zona tidak dapat dihapus karena masih digunakan oleh toko.",
    });
  }

  try {
    await zone.destroy();
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        error: "Zona tidak dapat dihapus karena masih memiliki data terkait.",
      });
    }
    throw error;
  }

  await logActivity(req, {
    action: "delete",
    entityType: "zone",
    entityId: zone.id,
    details: { name: zone.name },
  });
  res.status(204).end();
}

module.exports = { listZones, createZone, updateZone, deleteZone };
