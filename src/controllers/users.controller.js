const bcrypt = require("bcryptjs");
const User = require("../models/user");
const logActivity = require("../middleware/activity-log");

const USER_ROLES = ["admin", "spg", "collecting", "gudang", "owner"];

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function validateUsername(username) {
  return typeof username === "string" && username.trim().length >= 3 && username.trim().length <= 50;
}

function validatePassword(password) {
  return typeof password === "string" && password.length >= 8 && Buffer.byteLength(password, "utf8") <= 72;
}

function isRole(role) {
  return USER_ROLES.includes(role);
}

async function activeAdminCount() {
  return User.count({ where: { role: "admin", isActive: true } });
}

async function listUsers(_req, res) {
  const users = await User.findAll({ order: [["id", "ASC"]] });
  res.json({ users: users.map(publicUser) });
}

async function createUser(req, res) {
  const { username, password, role = "spg" } = req.body ?? {};
  if (!validateUsername(username) || !validatePassword(password) || !isRole(role)) {
    return res.status(400).json({
      error: "Username must be 3-50 characters; password must be 8-72 UTF-8 bytes; role is invalid.",
    });
  }

  const user = await User.create({
    username: username.trim(),
    password: await bcrypt.hash(password, 12),
    role,
  });
  await logActivity(req, {
    action: "create",
    entityType: "user",
    entityId: user.id,
    details: { username: user.username, role: user.role, isActive: user.isActive },
  });
  res.status(201).json({ user: publicUser(user) });
}

async function updateUser(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });

  const body = req.body ?? {};
  const allowedFields = ["username", "password", "role", "isActive"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ error: "Request contains unsupported fields." });
  }
  if (body.username !== undefined && !validateUsername(body.username)) {
    return res.status(400).json({ error: "Username must be 3-50 characters." });
  }
  if (body.password !== undefined && body.password !== "" && !validatePassword(body.password)) {
    return res.status(400).json({ error: "Password must be 8-72 UTF-8 bytes." });
  }
  if (body.role !== undefined && !isRole(body.role)) {
    return res.status(400).json({ error: "Role is invalid." });
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return res.status(400).json({ error: "isActive must be a boolean." });
  }

  const isCurrentAdmin = user.role === "admin" && user.isActive;
  const willDisableCurrentAdmin = isCurrentAdmin &&
    ((body.role !== undefined && body.role !== "admin") || body.isActive === false);
  if (willDisableCurrentAdmin && await activeAdminCount() <= 1) {
    return res.status(409).json({ error: "At least one active administrator must remain." });
  }

  if (body.username !== undefined) user.username = body.username.trim();
  if (body.role !== undefined) user.role = body.role;
  if (body.isActive !== undefined) user.isActive = body.isActive;
  if (body.password) user.password = await bcrypt.hash(body.password, 12);
  await user.save();
  await logActivity(req, {
    action: "update",
    entityType: "user",
    entityId: user.id,
    details: {
      changedFields: Object.keys(body).filter((field) => field !== "password"),
      passwordChanged: Boolean(body.password),
      username: user.username,
      role: user.role,
      isActive: user.isActive,
    },
  });
  res.json({ user: publicUser(user) });
}

async function deleteUser(req, res) {
  const user = await User.findByPk(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found." });
  if (user.id === req.user.id) {
    return res.status(409).json({ error: "You cannot delete your own account." });
  }
  if (user.role === "admin" && user.isActive && await activeAdminCount() <= 1) {
    return res.status(409).json({ error: "At least one active administrator must remain." });
  }
  const deletedUser = { id: user.id, username: user.username, role: user.role };
  await user.destroy();
  await logActivity(req, {
    action: "delete",
    entityType: "user",
    entityId: deletedUser.id,
    details: deletedUser,
  });
  res.status(204).end();
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
