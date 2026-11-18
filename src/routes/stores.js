const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, requireAdmin } = require("../middleware/authenticate");
const { listStores, createStore, updateStore, deleteStore } = require("../controllers/stores.controller");

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get("/", asyncHandler(listStores));
router.post("/", asyncHandler(createStore));
router.patch("/:id", asyncHandler(updateStore));
router.delete("/:id", asyncHandler(deleteStore));

module.exports = router;
