const Role = require("../models/role");
const User = require("../models/user");
const logActivity = require("../middleware/activity-log");

const ROLE_SLUGS = ["admin", "spg", "collecting", "gudang", "owner"];
const FEATURES = ["overview", "inventory", "sales", "stores", "users", "activity"];

const DEFAULT_PERMISSIONS = {
  owner: { overview: true, inventory: true, sales: true, stores: true, users: true, activity: true },
  admin: { overview: true, inventory: true, sales: true, stores: true, users: true, activity: true },
  gudang: { overview: true, inventory: true, sales: false, stores: false, users: false, activity: false },
  collecting: { overview: true, inventory: false, sales: true, stores: false, users: false, activity: false },
  spg: { overview: true, inventory: true, sales: true, stores: false, users: false, activity: false },
};

const ROLE_NAMES = {
  owner: "Owner",
  admin: "Admin",
  gudang: "Gudang",
  collecting: "Collecting",
  spg: "SPG",
};

function publicRole(role) {
  return {
    id: role.id,
    name: role.name,
    slug: role.slug,
    permissions: role.permissions,
    createdAt: role.createdAt,
  };
}

function isValidPermissions(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ROLE_SLUGS.every((slug) =>
    value[slug] &&
    typeof value[slug] === "object" &&
    FEATURES.every((feature) => typeof value[slug][feature] === "boolean"),
  );
}

function isValidRolePermissions(value) {
  return value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    FEATURES.every((feature) => typeof value[feature] === "boolean");
}

async function ensureDefaultRoles() {
  for (const slug of ROLE_SLUGS) {
    await Role.findOrCreate({
      where: { slug },
      defaults: { name: ROLE_NAMES[slug], slug, permissions: DEFAULT_PERMISSIONS[slug] },
    });
  }
}

async function listRoles(_req, res) {
  await ensureDefaultRoles();
  const roles = await Role.findAll({ order: [["id", "ASC"]] });
  const permissions = Object.fromEntries(
    roles.map((role) => [role.slug, role.permissions]),
  );
  res.json({ roles: roles.map(publicRole), permissions });
}

async function createRole(req, res) {
  const { name, slug, permissions } = req.body ?? {};
  if (
    typeof name !== "string" ||
    name.trim().length < 2 ||
    name.trim().length > 50 ||
    !ROLE_SLUGS.includes(slug) ||
    (permissions !== undefined && !isValidRolePermissions(permissions))
  ) {
    return res.status(400).json({ error: "Name, slug, or permissions are invalid." });
  }

  const role = await Role.create({
    name: name.trim(),
    slug,
    permissions: permissions ?? DEFAULT_PERMISSIONS[slug],
  });
  await logActivity(req, {
    action: "create",
    entityType: "role",
    entityId: role.id,
    details: { name: role.name, slug: role.slug },
  });
  res.status(201).json({ role: publicRole(role) });
}

async function updateRole(req, res) {
  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ error: "Role not found." });

  const body = req.body ?? {};
  const allowedFields = ["name", "slug", "permissions"];
  if (Object.keys(body).some((field) => !allowedFields.includes(field))) {
    return res.status(400).json({ error: "Request contains unsupported fields." });
  }
  if (body.name !== undefined && (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 50)) {
    return res.status(400).json({ error: "Name must be 2-50 characters." });
  }
  if (body.slug !== undefined && !ROLE_SLUGS.includes(body.slug)) {
    return res.status(400).json({ error: "Slug is invalid." });
  }
  if (body.permissions !== undefined && (body.permissions === null || typeof body.permissions !== "object" ||
      FEATURES.some((feature) => typeof body.permissions[feature] !== "boolean"))) {
    return res.status(400).json({ error: "Permissions are invalid." });
  }

  if (body.name !== undefined) role.name = body.name.trim();
  if (body.slug !== undefined) role.slug = body.slug;
  if (body.permissions !== undefined) role.permissions = body.permissions;
  await role.save();
  await logActivity(req, {
    action: "update",
    entityType: "role",
    entityId: role.id,
    details: { name: role.name, slug: role.slug, changedFields: Object.keys(body) },
  });
  res.json({ role: publicRole(role) });
}

async function deleteRole(req, res) {
  const role = await Role.findByPk(req.params.id);
  if (!role) return res.status(404).json({ error: "Role not found." });
  if (["owner", "admin"].includes(role.slug)) {
    return res.status(409).json({ error: "Owner and administrator roles cannot be deleted." });
  }
  const assignedUsers = await User.count({ where: { role: role.slug } });
  if (assignedUsers > 0) {
    return res.status(409).json({ error: "The role is still assigned to users." });
  }
  await role.destroy();
  await logActivity(req, {
    action: "delete",
    entityType: "role",
    entityId: role.id,
    details: { name: role.name, slug: role.slug },
  });
  res.status(204).end();
}

async function updatePermissions(req, res) {
  const { permissions } = req.body ?? {};
  if (!isValidPermissions(permissions)) {
    return res.status(400).json({ error: "The permissions matrix is invalid." });
  }

  await ensureDefaultRoles();
  for (const slug of ROLE_SLUGS) {
    const role = await Role.findOne({ where: { slug } });
    if (!role) continue;
    role.permissions = permissions[slug];
    await role.save();
  }
  await logActivity(req, {
    action: "update",
    entityType: "role_permissions",
    details: { roleCount: ROLE_SLUGS.length, featureCount: FEATURES.length },
  });
  res.json({ permissions });
}

module.exports = { listRoles, createRole, updateRole, deleteRole, updatePermissions };
