const { Op, col, fn } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("../models/branch");
const Store = require("../models/store");
const User = require("../models/user");
const logActivity = require("../middleware/activity-log");
const { paginationFromQuery, paginationMetadata } = require("../utils/pagination");
const { assignedBranchId } = require("../utils/user-branch");

function isValidDetails(body) {
  return typeof body.name === "string" &&
    body.name.trim().length > 0 &&
    body.name.trim().length <= 120 &&
    typeof body.city === "string" &&
    body.city.trim().length > 0 &&
    body.city.trim().length <= 100 &&
    typeof body.address === "string" &&
    body.address.trim().length > 0;
}

function publicBranch(
  branch,
  storeCount = 0,
  createdBy = branch.creator?.username ?? null,
) {
  return {
    id: branch.id,
    name: branch.name,
    city: branch.city,
    address: branch.address,
    createdBy,
    createdAt: branch.createdAt,
    storeCount,
  };
}

async function listBranches(req, res) {
  const pagination = paginationFromQuery(req.query);
  const where = {};
  const branchId = assignedBranchId(req);
  if (branchId !== null) where.id = branchId;
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = req.query.search.trim().replace(/[\\%_]/g, "\\$&");
    where[Op.or] = ["name", "city", "address"].map((field) => ({
      [field]: { [Op.like]: `%${search}%` },
    }));
  }
  const branchOptions = {
    where,
    include: [{ model: User, as: "creator", attributes: ["id", "username"] }],
    order: [["createdAt", "DESC"]],
  };
  const branchResult = pagination
    ? await Branch.findAndCountAll({
      ...branchOptions,
      limit: pagination.limit,
      offset: pagination.offset,
    })
    : { rows: await Branch.findAll(branchOptions), count: null };
  const branchIds = branchResult.rows.map(({ id }) => id);
  const storeCounts = branchIds.length
    ? await Store.findAll({
      attributes: [
        "branchId",
        [fn("COUNT", col("id")), "storeCount"],
      ],
      where: { branchId: { [Op.in]: branchIds } },
      group: ["branchId"],
      raw: true,
    })
    : [];
  const countsByBranch = new Map(
    storeCounts.map((entry) => [Number(entry.branchId), Number(entry.storeCount)]),
  );
  const payload = {
    branches: branchResult.rows.map((branch) =>
      publicBranch(branch, countsByBranch.get(branch.id) ?? 0),
    ),
  };
  if (pagination) payload.pagination = paginationMetadata(pagination, branchResult.count);
  res.json(payload);
}

async function createBranch(req, res) {
  if (assignedBranchId(req) !== null) {
    return res.status(403).json({ error: "Pengguna hanya dapat mengakses cabangnya sendiri." });
  }
  const body = req.body ?? {};
  const allowedFields = ["name", "city", "address"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field)) ||
    !isValidDetails(body)) {
    return res.status(400).json({
      error: "Nama cabang, kota, dan alamat yang valid wajib diisi.",
    });
  }

  const branch = await sequelize.transaction(async (transaction) => {
    const createdBranch = await Branch.create({
      name: body.name.trim(),
      city: body.city.trim(),
      address: body.address.trim(),
      createdBy: req.user.id,
    }, { transaction });
    await Store.update(
      { branchId: createdBranch.id },
      {
        where: { branchId: null, branch: createdBranch.name },
        transaction,
      },
    );
    return createdBranch;
  });
  const storeCount = await Store.count({ where: { branchId: branch.id } });
  await logActivity(req, {
    action: "create",
    entityType: "branch",
    entityId: branch.id,
    details: { name: branch.name, city: branch.city },
  });
  res.status(201).json({
    branch: publicBranch(branch, storeCount, req.user.username),
  });
}

async function updateBranch(req, res) {
  const assignedId = assignedBranchId(req);
  const branch = await Branch.findOne({
    where: { id: req.params.id, ...(assignedId === null ? {} : { id: assignedId }) },
    include: [{ model: User, as: "creator", attributes: ["id", "username"] }],
  });
  if (!branch) return res.status(404).json({ error: "Cabang tidak ditemukan." });

  const body = req.body ?? {};
  const allowedFields = ["name", "city", "address"];
  const updated = { ...branch.toJSON(), ...body };
  if (Object.keys(body).some((field) => !allowedFields.includes(field)) ||
    !isValidDetails(updated)) {
    return res.status(400).json({ error: "Data cabang tidak valid." });
  }

  await sequelize.transaction(async (transaction) => {
    branch.name = updated.name.trim();
    branch.city = updated.city.trim();
    branch.address = updated.address.trim();
    await branch.save({ transaction });
    await Store.update(
      { branch: branch.name },
      { where: { branchId: branch.id }, transaction },
    );
  });
  await logActivity(req, {
    action: "update",
    entityType: "branch",
    entityId: branch.id,
    details: { changedFields: Object.keys(body), name: branch.name, city: branch.city },
  });
  res.json({ branch: publicBranch(branch) });
}

async function deleteBranch(req, res) {
  const assignedId = assignedBranchId(req);
  const branch = await Branch.findOne({
    where: { id: req.params.id, ...(assignedId === null ? {} : { id: assignedId }) },
  });
  if (!branch) return res.status(404).json({ error: "Cabang tidak ditemukan." });

  const storeCount = await Store.count({ where: { branchId: branch.id } });
  const assignedUserCount = await User.count({ where: { branchId: branch.id } });
  if (storeCount > 0 || assignedUserCount > 0) {
    return res.status(409).json({
      error: assignedUserCount > 0
        ? "Cabang tidak dapat dihapus karena masih ditetapkan kepada pengguna."
        : "Cabang tidak dapat dihapus karena masih digunakan oleh toko.",
    });
  }

  try {
    await branch.destroy();
  } catch (error) {
    if (error.name === "SequelizeForeignKeyConstraintError") {
      return res.status(409).json({
        error: "Cabang tidak dapat dihapus karena masih memiliki data terkait.",
      });
    }
    throw error;
  }

  await logActivity(req, {
    action: "delete",
    entityType: "branch",
    entityId: branch.id,
    details: { name: branch.name, city: branch.city },
  });
  res.status(204).end();
}

module.exports = { listBranches, createBranch, updateBranch, deleteBranch };
