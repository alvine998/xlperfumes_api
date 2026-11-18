const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requireAdmin } = require("../middleware/authenticate");
const { listActivityLogs } = require("../controllers/activity-logs.controller");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(listActivityLogs));

module.exports = router;
