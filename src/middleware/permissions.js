const Role = require("../models/role");
const { authenticate } = require("./authenticate");
const { normalizeRolePermissions } = require("../utils/permissions");

async function getPermissionsForRole(roleSlug) {
  const role = await Role.findOne({ where: { slug: roleSlug } });
  return normalizeRolePermissions(role?.permissions, roleSlug);
}

function requirePermission(features) {
  const requiredFeatures = Array.isArray(features) ? features : [features];
  return async (req, res, next) => {
    try {
      const permissions = await getPermissionsForRole(req.user.role);
      const allowed = requiredFeatures.some((feature) => permissions[feature] === true);
      if (!allowed) {
        return res.status(403).json({ error: "You do not have access to this feature." });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireRole(roles) {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user?.role)) {
      return res.status(403).json({ error: "Fitur ini tidak tersedia untuk peran akun Anda." });
    }
    next();
  };
}

module.exports = { authenticate, getPermissionsForRole, requirePermission, requireRole };
