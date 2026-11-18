const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { listVariants, createVariant, updateVariant, deleteVariant } = require("../controllers/variants.controller");

const router = express.Router();

router.use(authenticate, requirePermission("inventory"));

router.get("/", asyncHandler(listVariants));
router.post("/", asyncHandler(createVariant));
router.patch("/:id", asyncHandler(updateVariant));
router.delete("/:id", asyncHandler(deleteVariant));

module.exports = router;
