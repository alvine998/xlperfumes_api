const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requireAdmin } = require("../middleware/authenticate");
const { listUsers, createUser, updateUser, deleteUser } = require("../controllers/users.controller");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(listUsers));
router.post("/", asyncHandler(createUser));
router.patch("/:id", asyncHandler(updateUser));
router.delete("/:id", asyncHandler(deleteUser));

module.exports = router;
