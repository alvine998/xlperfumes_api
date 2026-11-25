const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission, requireRole } = require("../middleware/permissions");
const {
  adjustStoreStock,
  getVisitStoreStock,
  listStoreStock,
  receiveStoreStock,
  receiveVisitProducts,
  updateVisitProductStatus,
} = require("../controllers/store-stock.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission("store_inventory"), asyncHandler(listStoreStock));
router.post("/:storeId/receive", requirePermission("store_inventory"), asyncHandler(receiveStoreStock));
router.patch("/:storeId/:variantId", requirePermission("store_inventory"), asyncHandler(adjustStoreStock));
router.get("/:storeId/visit", requirePermission("store_visit"), asyncHandler(getVisitStoreStock));
router.post("/:storeId/visit/receive", requirePermission("store_visit"), requireRole("collecting"), asyncHandler(receiveVisitProducts));
router.patch("/:storeId/visit/stock/:variantId", requirePermission("store_visit"), requireRole("collecting"), asyncHandler(adjustStoreStock));
router.patch("/:storeId/visit/status", requirePermission("store_visit"), requireRole("collecting"), asyncHandler(updateVisitProductStatus));

module.exports = router;
