const { col, fn } = require("sequelize");
const sequelize = require("../config/database");
const Zone = require("../models/zone");
const Branch = require("../models/branch");
const Store = require("../models/store");
const StoreZona = require("../models/store-zona");
const User = require("../models/user");
const UserZona = require("../models/user-zona");
const logActivity = require("../middleware/activity-log");

function publicZone(
  zone,
  storeCount = 0,
  createdBy = zone.creator?.username ?? null,
  memberCount = 0,
) {
  return {
    id: zone.id,
    name: zone.name,
    branchId: zone.branchId,
    branch: zone.branchRecord?.name ?? null,
    userPicId: zone.userPicId ?? null,
    picUsername: zone.pic?.username ?? null,
    createdBy,
    createdAt: zone.createdAt,
    storeCount,
    memberCount,
  };
}

function publicZoneStore(store, routeIndex) {
  return {
    id: store.id,
    name: store.name,
    branch: store.branchRecord?.name ?? store.branch,
    address: store.address,
    latitude: Number(store.latitude),
    longitude: Number(store.longitude),
    routeIndex,
    createdAt: store.createdAt,
  };
}

function isValidDetails(body) {
  const branchId = Number(body.branchId);
  const userPicId = body.userPicId;
  return typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 120 &&
    Number.isInteger(branchId) &&
    branchId > 0 &&
    (userPicId === undefined ||
      userPicId === null ||
      (Number.isInteger(Number(userPicId)) && Number(userPicId) > 0));
}

async function listZones(_req, res) {
  const [zones, storeCounts, memberCounts] = await Promise.all([
    Zone.findAll({
      include: [
        { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
        { model: User, as: "creator", attributes: ["id", "username"] },
        { model: User, as: "pic", attributes: ["id", "username"] },
      ],
      order: [["createdAt", "DESC"]],
    }),
    StoreZona.findAll({
      attributes: ["zonaId", [fn("COUNT", col("storeId")), "storeCount"]],
      group: ["zonaId"],
      raw: true,
    }),
    UserZona.findAll({
      attributes: ["zonaId", [fn("COUNT", col("user_id")), "memberCount"]],
      group: ["zonaId"],
      raw: true,
    }),
  ]);
  const countsByZone = new Map(
    storeCounts.map((entry) => [Number(entry.zonaId), Number(entry.storeCount)]),
  );
  const membersByZone = new Map(
    memberCounts.map((entry) => [Number(entry.zonaId), Number(entry.memberCount)]),
  );
  res.json({
    zones: zones.map((zone) =>
      publicZone(
        zone,
        countsByZone.get(zone.id) ?? 0,
        undefined,
        membersByZone.get(zone.id) ?? 0,
      ),
    ),
  });
}

async function listZoneCollectors(_req, res) {
  const users = await User.findAll({
    attributes: ["id", "username"],
    where: { role: "collecting", isActive: true },
    order: [["username", "ASC"]],
  });
  res.json({
    users: users.map((user) => ({ id: user.id, username: user.username })),
  });
}

async function getZoneDetail(req, res) {
  const zone = await Zone.findByPk(req.params.id, {
    include: [
      { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
      { model: User, as: "creator", attributes: ["id", "username"] },
      { model: User, as: "pic", attributes: ["id", "username"] },
    ],
  });
  if (!zone) return res.status(404).json({ error: "Zona tidak ditemukan." });

  const [storeAssignments, branchStores, memberCount] = await Promise.all([
    StoreZona.findAll({
      where: { zonaId: zone.id },
      include: [{
        model: Store,
        as: "store",
        include: [{ model: Branch, as: "branchRecord", attributes: ["id", "name"] }],
      }],
      order: [["routeIndex", "ASC"], ["storeId", "ASC"]],
    }),
    Store.findAll({
      where: { branchId: zone.branchId },
      include: [{ model: Branch, as: "branchRecord", attributes: ["id", "name"] }],
      order: [["name", "ASC"]],
    }),
    UserZona.count({ where: { zonaId: zone.id } }),
  ]);
  const currentStoreIds = new Set(storeAssignments.map(({ storeId }) => storeId));
  const assignedStoreRows = await StoreZona.findAll({
    attributes: ["storeId"],
    where: { storeId: branchStores.map(({ id }) => id) },
  });
  const assignedStoreIds = new Set(assignedStoreRows.map(({ storeId }) => storeId));
  const stores = storeAssignments.map(({ store, routeIndex }) =>
    publicZoneStore(store, routeIndex),
  );
  const availableStores = branchStores
    .filter((store) =>
      !currentStoreIds.has(store.id) && !assignedStoreIds.has(store.id),
    )
    .map((store) => ({
      id: store.id,
      name: store.name,
      branch: store.branchRecord?.name ?? store.branch,
      branchId: store.branchId,
      zonaId: null,
      zona: null,
      routeIndex: null,
      address: store.address,
      latitude: Number(store.latitude),
      longitude: Number(store.longitude),
      createdAt: store.createdAt,
    }));
  res.json({
    zone: publicZone(zone, stores.length, undefined, memberCount),
    stores,
    availableStores,
  });
}

async function createZone(req, res) {
  const body = req.body ?? {};
  const allowedFields = ["name", "branchId", "userPicId"];
  if (
    Object.keys(body).some((field) => !allowedFields.includes(field)) ||
    !isValidDetails(body)
  ) {
    return res.status(400).json({ error: "Nama zona dan cabang yang valid wajib diisi." });
  }

  const branch = await Branch.findByPk(Number(body.branchId));
  if (!branch) return res.status(400).json({ error: "Cabang tidak ditemukan." });

  let pic = null;
  if (body.userPicId !== undefined && body.userPicId !== null) {
    pic = await User.findOne({
      where: {
        id: Number(body.userPicId),
        role: "collecting",
        isActive: true,
      },
    });
    if (!pic) {
      return res.status(400).json({
        error: "PIC harus merupakan pengguna collecting yang aktif.",
      });
    }
  }

  const zone = await Zone.create({
    name: body.name.trim(),
    branchId: branch.id,
    userPicId: pic?.id ?? null,
    createdBy: req.user.id,
  });
  zone.branchRecord = branch;
  zone.pic = pic;
  await logActivity(req, {
    action: "create",
    entityType: "zone",
    entityId: zone.id,
    details: { name: zone.name, branch: branch.name },
  });
  res.status(201).json({
    zone: publicZone(zone, 0, req.user.username, 0),
  });
}

async function updateZone(req, res) {
  const body = req.body ?? {};
  const result = await sequelize.transaction(async (transaction) => {
    const zone = await Zone.findByPk(req.params.id, {
      include: [
        { model: Branch, as: "branchRecord", attributes: ["id", "name"] },
        { model: User, as: "creator", attributes: ["id", "username"] },
        { model: User, as: "pic", attributes: ["id", "username"] },
      ],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!zone) return { status: 404, error: "Zona tidak ditemukan." };

    const storeCount = await StoreZona.count({
      where: { zonaId: zone.id },
      transaction,
    });
    if (storeCount > 0) {
      return {
        status: 409,
        error: "Zona tidak dapat diubah karena masih digunakan oleh toko.",
      };
    }

    const allowedFields = ["name", "branchId", "userPicId"];
    const updated = { ...zone.toJSON(), ...body };
    if (
      Object.keys(body).some((field) => !allowedFields.includes(field)) ||
      !isValidDetails(updated)
    ) {
      return { status: 400, error: "Data zona tidak valid." };
    }

    const branch = await Branch.findByPk(Number(updated.branchId), { transaction });
    if (!branch) return { status: 400, error: "Cabang tidak ditemukan." };

    let pic = null;
    if (updated.userPicId !== undefined && updated.userPicId !== null) {
      pic = await User.findOne({
        where: {
          id: Number(updated.userPicId),
          role: "collecting",
          isActive: true,
        },
        transaction,
      });
      if (!pic && Number(updated.userPicId) !== zone.userPicId) {
        return {
          status: 400,
          error: "PIC harus merupakan pengguna collecting yang aktif.",
        };
      }
      if (!pic && zone.userPicId) {
        pic = await User.findByPk(zone.userPicId, { transaction });
      }
    }

    zone.name = updated.name.trim();
    zone.branchId = branch.id;
    zone.userPicId = pic?.id ?? null;
    await zone.save({ transaction });
    zone.branchRecord = branch;
    zone.pic = pic;
    return { zone, changedFields: Object.keys(body), branch };
  });
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  const { zone, changedFields, branch } = result;
  const memberCount = await UserZona.count({ where: { zonaId: zone.id } });
  await logActivity(req, {
    action: "update",
    entityType: "zone",
    entityId: zone.id,
    details: { changedFields, name: zone.name, branch: branch.name },
  });
  res.json({ zone: publicZone(zone, 0, undefined, memberCount) });
}

async function getZoneUsers(req, res) {
  const zone = await Zone.findByPk(req.params.id, { attributes: ["id"] });
  if (!zone) return res.status(404).json({ error: "Zona tidak ditemukan." });

  const assignments = await UserZona.findAll({
    where: { zonaId: zone.id },
    include: [{
      model: User,
      as: "user",
      attributes: ["id", "username", "role", "isActive"],
    }],
    order: [[{ model: User, as: "user" }, "username", "ASC"]],
  });
  res.json({
    users: assignments.map(({ user }) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    })),
  });
}

async function updateZoneUsers(req, res) {
  const userIds = req.body?.userIds;
  if (
    !Array.isArray(userIds) ||
    userIds.some((id) => !Number.isInteger(id) || id < 1) ||
    new Set(userIds).size !== userIds.length
  ) {
    return res.status(400).json({ error: "Daftar pengguna zona tidak valid." });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const zone = await Zone.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!zone) return { status: 404, error: "Zona tidak ditemukan." };

    const [collectors, currentAssignments] = await Promise.all([
      User.findAll({
        attributes: ["id"],
        where: { id: userIds, role: "collecting", isActive: true },
        transaction,
      }),
      UserZona.findAll({
        attributes: ["userId"],
        where: { zonaId: zone.id },
        transaction,
      }),
    ]);
    const allowedIds = new Set([
      ...collectors.map((user) => user.id),
      ...currentAssignments.map(({ userId }) => userId),
    ]);
    if (userIds.some((id) => !allowedIds.has(id))) {
      return {
        status: 400,
        error: "Zona hanya dapat diisi pengguna collecting yang aktif.",
      };
    }

    await UserZona.destroy({ where: { zonaId: zone.id }, transaction });
    if (userIds.length) {
      await UserZona.bulkCreate(
        userIds.map((userId) => ({ zonaId: zone.id, userId })),
        { transaction },
      );
    }
    return { zone };
  });
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  const assignments = await UserZona.findAll({
    where: { zonaId: result.zone.id },
    include: [{
      model: User,
      as: "user",
      attributes: ["id", "username", "role", "isActive"],
    }],
    order: [[{ model: User, as: "user" }, "username", "ASC"]],
  });
  await logActivity(req, {
    action: "update",
    entityType: "zone_users",
    entityId: result.zone.id,
    details: { userIds: assignments.map(({ user }) => user.id) },
  });
  res.json({
    users: assignments.map(({ user }) => ({
      id: user.id,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    })),
  });
}

async function updateZoneStoreOrder(req, res) {
  const storeIds = req.body?.storeIds;
  if (
    !Array.isArray(storeIds) ||
    storeIds.some((id) => !Number.isInteger(id) || id < 1) ||
    new Set(storeIds).size !== storeIds.length
  ) {
    return res.status(400).json({ error: "Urutan toko tidak valid." });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const zone = await Zone.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!zone) return { status: 404, error: "Zona tidak ditemukan." };

    const stores = await StoreZona.findAll({
      attributes: ["storeId"],
      where: { zonaId: zone.id },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    const currentIds = new Set(stores.map(({ storeId }) => storeId));
    if (
      storeIds.length !== stores.length ||
      storeIds.some((id) => !currentIds.has(id))
    ) {
      return { status: 400, error: "Daftar toko zona telah berubah. Muat ulang lalu coba lagi." };
    }

    for (const [index, storeId] of storeIds.entries()) {
      await StoreZona.update({ routeIndex: index + 1 }, {
        where: { storeId, zonaId: zone.id },
        transaction,
      });
    }
    return { zone };
  });
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  const stores = await StoreZona.findAll({
    where: { zonaId: result.zone.id },
    include: [{
      model: Store,
      as: "store",
      include: [{ model: Branch, as: "branchRecord", attributes: ["id", "name"] }],
    }],
    order: [["routeIndex", "ASC"], ["storeId", "ASC"]],
  });
  await logActivity(req, {
    action: "update",
    entityType: "zone_store_order",
    entityId: result.zone.id,
    details: { storeIds },
  });
  res.json({
    stores: stores.map(({ store, routeIndex }) => publicZoneStore(store, routeIndex)),
  });
}

async function assignStoresToZone(req, storeIds) {
  const result = await sequelize.transaction(async (transaction) => {
    const zone = await Zone.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!zone) return { status: 404, error: "Zona tidak ditemukan." };

    const storeRows = await Store.findAll({
      where: { id: storeIds },
      include: [{ model: Branch, as: "branchRecord", attributes: ["id", "name"] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (storeRows.length !== storeIds.length) {
      return { status: 404, error: "Satu atau beberapa toko tidak ditemukan." };
    }

    const storesById = new Map(storeRows.map((store) => [store.id, store]));
    const stores = storeIds.map((storeId) => storesById.get(storeId));
    if (stores.some((store) => !store || store.branchId !== zone.branchId)) {
      return {
        status: 400,
        error: "Semua toko harus berasal dari cabang zona ini.",
      };
    }

    const existing = await StoreZona.findAll({
      attributes: ["storeId", "zonaId"],
      where: { storeId: storeIds },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (existing.length > 0) {
      const alreadyInZone = existing.some(({ zonaId }) => zonaId === zone.id);
      return {
        status: 409,
        error: alreadyInZone
          ? "Satu atau beberapa toko sudah ada di zona ini."
          : "Satu atau beberapa toko sudah terhubung ke zona lain.",
      };
    }

    const maxRouteIndex = await StoreZona.max("routeIndex", {
      where: { zonaId: zone.id },
      transaction,
    });
    const firstRouteIndex = maxRouteIndex === null ? 1 : Number(maxRouteIndex) + 1;
    await StoreZona.bulkCreate(stores.map((store, index) => ({
      storeId: store.id,
      zonaId: zone.id,
      routeIndex: firstRouteIndex + index,
    })), { transaction });
    return {
      zone,
      stores: stores.map((store, index) =>
        publicZoneStore(store, firstRouteIndex + index),
      ),
    };
  });
  return result;
}

async function addZoneStore(req, res) {
  const storeId = Number(req.params.storeId);
  if (!Number.isInteger(storeId) || storeId < 1) {
    return res.status(400).json({ error: "Toko tidak valid." });
  }

  const result = await assignStoresToZone(req, [storeId]);
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  await logActivity(req, {
    action: "create",
    entityType: "zone_store",
    entityId: result.zone.id,
    details: {
      storeId: result.stores[0].id,
      storeName: result.stores[0].name,
    },
  });
  res.status(201).json({
    store: result.stores[0],
  });
}

async function addZoneStores(req, res) {
  const storeIds = req.body?.storeIds;
  if (
    !Array.isArray(storeIds) ||
    storeIds.length === 0 ||
    storeIds.some((id) => !Number.isInteger(id) || id < 1) ||
    new Set(storeIds).size !== storeIds.length
  ) {
    return res.status(400).json({ error: "Daftar toko tidak valid." });
  }

  const result = await assignStoresToZone(req, storeIds);
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  await logActivity(req, {
    action: "create",
    entityType: "zone_store",
    entityId: result.zone.id,
    details: {
      storeIds: result.stores.map(({ id }) => id),
      storeNames: result.stores.map(({ name }) => name),
    },
  });
  res.status(201).json({ stores: result.stores });
}

async function removeZoneStore(req, res) {
  const storeId = Number(req.params.storeId);
  if (!Number.isInteger(storeId) || storeId < 1) {
    return res.status(400).json({ error: "Toko tidak valid." });
  }

  const result = await sequelize.transaction(async (transaction) => {
    const zone = await Zone.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!zone) return { status: 404, error: "Zona tidak ditemukan." };

    const assignment = await StoreZona.findOne({
      where: { storeId, zonaId: zone.id },
      include: [{ model: Store, as: "store", attributes: ["id", "name"] }],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!assignment) {
      return { status: 404, error: "Toko tidak terhubung ke zona ini." };
    }
    const removedStore = assignment.store;
    await assignment.destroy({ transaction });

    const remaining = await StoreZona.findAll({
      where: { zonaId: zone.id },
      order: [["routeIndex", "ASC"], ["storeId", "ASC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    for (const [index, remainingAssignment] of remaining.entries()) {
      await remainingAssignment.update({ routeIndex: index + 1 }, { transaction });
    }
    return { zone, removedStore };
  });
  if ("status" in result) return res.status(result.status).json({ error: result.error });

  await logActivity(req, {
    action: "delete",
    entityType: "zone_store",
    entityId: result.zone.id,
    details: { storeId, storeName: result.removedStore.name },
  });
  res.status(204).end();
}

async function deleteZone(req, res) {
  const zone = await Zone.findByPk(req.params.id);
  if (!zone) return res.status(404).json({ error: "Zona tidak ditemukan." });

  const storeCount = await StoreZona.count({ where: { zonaId: zone.id } });
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

module.exports = {
  listZones,
  getZoneDetail,
  listZoneCollectors,
  createZone,
  updateZone,
  getZoneUsers,
  updateZoneUsers,
  updateZoneStoreOrder,
  addZoneStores,
  addZoneStore,
  removeZoneStore,
  deleteZone,
};
