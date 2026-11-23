const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { deleteProduct, generateProducts, getProduct, listProductBranches, listProducts, moveWarehouseProducts } = require("../controllers/products.controller");

const router = express.Router();
router.use(authenticate, requirePermission("inventory"));
router.get("/branches", asyncHandler(listProductBranches));
router.post("/warehouse-movement", asyncHandler(moveWarehouseProducts));
router.post("/generate", asyncHandler(generateProducts));
router.get("/", asyncHandler(listProducts));
router.get("/:id", asyncHandler(getProduct));
router.delete("/:id", asyncHandler(deleteProduct));

module.exports = router;
