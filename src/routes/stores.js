const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { requireAdmin } = require("../middleware/authenticate");
const { listStores, createStore, updateStore, deleteStore } = require("../controllers/stores.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission([
  "stores", "zonas", "store_inventory", "warehouse_inventory", "store_visit", "print_store_barcodes",
]), asyncHandler(listStores));
router.post("/", requirePermission("stores"), requireAdmin, asyncHandler(createStore));
router.patch("/:id", requirePermission("stores"), requireAdmin, asyncHandler(updateStore));
router.delete("/:id", requirePermission("stores"), requireAdmin, asyncHandler(deleteStore));

module.exports = router;
