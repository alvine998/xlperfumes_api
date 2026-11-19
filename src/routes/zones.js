const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const {
  listZones,
  createZone,
  updateZone,
  deleteZone,
} = require("../controllers/zones.controller");

const router = express.Router();

router.use(authenticate, requirePermission("stores"));

router.get("/", asyncHandler(listZones));
router.post("/", asyncHandler(createZone));
router.patch("/:id", asyncHandler(updateZone));
router.delete("/:id", asyncHandler(deleteZone));

module.exports = router;
