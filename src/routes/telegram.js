const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { handleTelegramWebhook } = require("../controllers/telegram.controller");

const router = express.Router();

router.post("/webhook", asyncHandler(handleTelegramWebhook));

module.exports = router;
