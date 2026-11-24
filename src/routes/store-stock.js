const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { listStoreStock, adjustStoreStock, receiveStoreStock } = require("../controllers/store-stock.controller");

const router = express.Router();

router.use(authenticate, requirePermission("store_inventory"));

router.get("/", asyncHandler(listStoreStock));
router.post("/:storeId/receive", asyncHandler(receiveStoreStock));
router.patch("/:storeId/:variantId", asyncHandler(adjustStoreStock));

module.exports = router;
