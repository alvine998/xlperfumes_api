const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { listStoreStock, adjustStoreStock } = require("../controllers/store-stock.controller");

const router = express.Router();

router.use(authenticate, requirePermission("inventory"));

router.get("/", asyncHandler(listStoreStock));
router.patch("/:storeId", asyncHandler(adjustStoreStock));

module.exports = router;
