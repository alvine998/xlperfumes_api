const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { listVariants, createVariant, updateVariant, deleteVariant } = require("../controllers/variants.controller");

const router = express.Router();

router.use(authenticate);

router.get("/", requirePermission([
  "variants", "products", "generate_product", "store_inventory", "warehouse_inventory",
]), asyncHandler(listVariants));
router.post("/", requirePermission("variants"), asyncHandler(createVariant));
router.patch("/:id", requirePermission("variants"), asyncHandler(updateVariant));
router.delete("/:id", requirePermission("variants"), asyncHandler(deleteVariant));

module.exports = router;
