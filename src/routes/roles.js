const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const {
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  updatePermissions,
} = require("../controllers/roles.controller");

const router = express.Router();

router.use(authenticate, requirePermission("users"));

router.get("/", asyncHandler(listRoles));
router.put("/permissions", asyncHandler(updatePermissions));
router.post("/", asyncHandler(createRole));
router.patch("/:id", asyncHandler(updateRole));
router.delete("/:id", asyncHandler(deleteRole));

module.exports = router;
