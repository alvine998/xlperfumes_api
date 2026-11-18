const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user");
const logActivity = require("../middleware/activity-log");
const { COOKIE_NAME, getJwtSecret } = require("../middleware/authenticate");
const { getPermissionsForRole } = require("../middleware/permissions");

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

async function login(req, res) {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const user = await User.unscoped().findOne({ where: { username: username.trim() } });
  const passwordMatches = user &&
    Buffer.byteLength(password, "utf8") <= 72 &&
    await bcrypt.compare(password, user.password);
  if (!user || !passwordMatches || !user.isActive) {
    await logActivity(req, {
      action: "login_failed",
      entityType: "auth",
      details: { attemptedUsername: username.trim() },
      username: username.trim(),
    });
    return res.status(401).json({ error: "Invalid username or password." });
  }

  const token = jwt.sign(
    { sub: String(user.id) },
    getJwtSecret(),
    { algorithm: "HS256", expiresIn: "8h", issuer: "xlperfumes-api" },
  );
  setTokenCookie(res, token);
  await logActivity(req, { action: "login", entityType: "auth", user });
  res.json({ token, user: publicUser(user) });
}

async function logout(req, res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  await logActivity(req, { action: "logout", entityType: "auth" });
  res.status(204).end();
}

async function getCurrentUser(req, res) {
  const user = publicUser(req.user);
  const permissions = await getPermissionsForRole(req.user.role);
  res.json({ user: { ...user, permissions } });
}

module.exports = { login, logout, getCurrentUser };
