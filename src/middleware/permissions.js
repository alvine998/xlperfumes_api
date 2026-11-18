const Role = require("../models/role");
const { authenticate } = require("./authenticate");

const DEFAULTS = {
  owner: { overview: true, inventory: true, sales: true, stores: true, users: true, activity: true },
  admin: { overview: true, inventory: true, sales: true, stores: true, users: true, activity: true },
  gudang: { overview: true, inventory: true, sales: false, stores: false, users: false, activity: false },
  collecting: { overview: true, inventory: false, sales: true, stores: false, users: false, activity: false },
  spg: { overview: true, inventory: true, sales: true, stores: false, users: false, activity: false },
};

function requirePermission(feature) {
  return async (req, res, next) => {
    try {
      const role = await Role.findOne({ where: { slug: req.user.role } });
      const allowed = role?.permissions?.[feature] ?? DEFAULTS[req.user.role]?.[feature] ?? false;
      if (!allowed) {
        return res.status(403).json({ error: "You do not have access to this feature." });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { authenticate, requirePermission };
