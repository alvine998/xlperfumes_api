const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission, requireRole } = require("../middleware/permissions");
const { deleteProduct, generateProducts, getOperationalDashboardSummary, getProduct, listPickupProducts, listProductBranches, listProducts, moveWarehouseProducts, pickWarehouseProducts } = require("../controllers/products.controller");

const router = express.Router();
router.use(authenticate);
router.get("/branches", requirePermission([
  "products", "variants", "generate_product", "print_product_barcodes", "warehouse_inventory",
]), asyncHandler(listProductBranches));
router.get("/dashboard-summary", requirePermission("overview"), requireRole(["spg", "gudang", "collecting"]), asyncHandler(getOperationalDashboardSummary));
router.get("/pickup", requireRole(["spg", "collecting"]), asyncHandler(listPickupProducts));
router.post("/pickup", requireRole(["spg", "collecting"]), asyncHandler(pickWarehouseProducts));
router.post("/warehouse-movement", requirePermission("warehouse_inventory"), asyncHandler(moveWarehouseProducts));
router.post("/generate", requirePermission("generate_product"), asyncHandler(generateProducts));
router.get("/", requirePermission([
  "products", "generate_product", "print_product_barcodes", "warehouse_inventory",
]), asyncHandler(listProducts));
router.get("/:id", requirePermission("products"), asyncHandler(getProduct));
router.delete("/:id", requirePermission("products"), asyncHandler(deleteProduct));

module.exports = router;
