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

router.use(authenticate, requirePermission("stores"));

router.get("/", asyncHandler(listBranches));
router.post("/", asyncHandler(createBranch));
router.patch("/:id", asyncHandler(updateBranch));
router.delete("/:id", asyncHandler(deleteBranch));

module.exports = router;
