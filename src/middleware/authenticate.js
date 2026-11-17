const jwt = require("jsonwebtoken");
const User = require("../models/user");
const asyncHandler = require("./async-handler");

const COOKIE_NAME = "xlperfumes_token";

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be configured with at least 32 characters.");
  }
  return secret;
}

function getCookieToken(cookieHeader) {
  if (!cookieHeader) return null;
  const tokenCookie = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));
  return tokenCookie ? tokenCookie.slice(COOKIE_NAME.length + 1) : null;
}

const authenticate = asyncHandler(async (req, res, next) => {
  const authorization = req.get("authorization");
  const bearerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const token = bearerToken || getCookieToken(req.get("cookie"));
  if (!token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  let claims;
  try {
    claims = jwt.verify(token, getJwtSecret(), {
      algorithms: ["HS256"],
      issuer: "xlperfumes-api",
    });
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }

  if (typeof claims === "string" || typeof claims.sub !== "string") {
    return res.status(401).json({ error: "Invalid token." });
  }

  const user = await User.findByPk(claims.sub);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: "Account is unavailable." });
  }

  req.user = user;
  next();
});

function requireAdmin(req, res, next) {
  if (req.user.role !== "admin") {
    return res.status(403).json({ error: "Administrator access required." });
  }
  next();
}

module.exports = { authenticate, getJwtSecret, requireAdmin, COOKIE_NAME };
