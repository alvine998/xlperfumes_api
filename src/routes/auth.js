const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate } = require("../middleware/authenticate");
const { login, logout, getCurrentUser } = require("../controllers/auth.controller");

const router = express.Router();

router.post("/login", asyncHandler(login));
router.post("/logout", authenticate, asyncHandler(logout));
router.get("/me", authenticate, asyncHandler(getCurrentUser));

module.exports = router;
