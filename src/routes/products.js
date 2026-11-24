const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { deleteProduct, generateProducts, getProduct, listProductBranches, listProducts, moveWarehouseProducts } = require("../controllers/products.controller");

const router = express.Router();
router.use(authenticate);
router.get("/branches", requirePermission([
  "products", "variants", "generate_product", "print_product_barcodes", "warehouse_inventory",
]), asyncHandler(listProductBranches));
router.post("/warehouse-movement", requirePermission("warehouse_inventory"), asyncHandler(moveWarehouseProducts));
router.post("/generate", requirePermission("generate_product"), asyncHandler(generateProducts));
router.get("/", requirePermission([
  "products", "generate_product", "print_product_barcodes", "warehouse_inventory",
]), asyncHandler(listProducts));
router.get("/:id", requirePermission("products"), asyncHandler(getProduct));
router.delete("/:id", requirePermission("products"), asyncHandler(deleteProduct));

module.exports = router;
