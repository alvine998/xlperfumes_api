const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requirePermission } = require("../middleware/permissions");
const { listActivityLogs } = require("../controllers/activity-logs.controller");

const router = express.Router();

router.use(authenticate, requirePermission("activity_logs"));

router.get("/", asyncHandler(listActivityLogs));

module.exports = router;
