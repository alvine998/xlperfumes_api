const bcrypt = require("bcryptjs");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const asyncHandler = require("../middleware/async-handler");
const { authenticate, COOKIE_NAME, getJwtSecret } = require("../middleware/authenticate");

const router = express.Router();
const TOKEN_LIFETIME_MS = 8 * 60 * 60 * 1000;

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  };
}

function setTokenCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: TOKEN_LIFETIME_MS,
    path: "/",
  });
}

router.post("/login", asyncHandler(async (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = await User.unscoped().findOne({ where: { username: username.trim() } });
  const passwordMatches = user &&
    Buffer.byteLength(password, "utf8") <= 72 &&
    await bcrypt.compare(password, user.password);
  if (!user || !passwordMatches || !user.isActive) {
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = jwt.sign(
    { sub: String(user.id) },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "8h", issuer: "xlperfumes-api" },
  );
  setTokenCookie(res, token);
  res.json({ token, user: publicUser(user) });
}));

router.post("/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.status(204).end();
});

router.get("/me", authenticate, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

module.exports = router;
