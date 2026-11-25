const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const {
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
} = require("../controllers/branches.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission([
  "branchs", "zonas", "stores", "users", "store_inventory", "warehouse_inventory", "store_visit", "print_store_barcodes",
]), asyncHandler(listBranches));
router.post("/", requirePermission("branchs"), asyncHandler(createBranch));
router.patch("/:id", requirePermission("branchs"), asyncHandler(updateBranch));
router.delete("/:id", requirePermission("branchs"), asyncHandler(deleteBranch));

module.exports = router;
