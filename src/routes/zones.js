const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const {
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
} = require("../controllers/zones.controller");

const router = express.Router();

router.use(authenticate, requirePermission("stores"));

router.get("/", asyncHandler(listZones));
router.get("/collectors", asyncHandler(listZoneCollectors));
router.post("/", asyncHandler(createZone));
router.get("/:id", asyncHandler(getZoneDetail));
router.put("/:id/stores/order", asyncHandler(updateZoneStoreOrder));
router.post("/:id/stores", asyncHandler(addZoneStores));
router.post("/:id/stores/:storeId", asyncHandler(addZoneStore));
router.delete("/:id/stores/:storeId", asyncHandler(removeZoneStore));
router.get("/:id/users", asyncHandler(getZoneUsers));
router.put("/:id/users", asyncHandler(updateZoneUsers));
router.patch("/:id", asyncHandler(updateZone));
router.delete("/:id", asyncHandler(deleteZone));

module.exports = router;
