const cors = require("cors");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const storeRoutes = require("./routes/stores");
const storeStockRoutes = require("./routes/store-stock");
const activityLogRoutes = require("./routes/activity-logs");
const roleRoutes = require("./routes/roles");
const telegramRoutes = require("./routes/telegram");
const openapiSpec = require("./docs/openapi");

const app = express();

app.use(cors({
  origin: process.env.WEB_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/stores", storeRoutes);
app.use("/api/store-stock", storeStockRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/telegram", telegramRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api-docs.json", (_req, res) => {
  res.json(openapiSpec);
});

app.get("/", (_req, res) => {
  res.json({ message: "XL Perfumes API is running" });
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: "Request body contains invalid JSON." });
  }
  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({ error: "One or more submitted fields are invalid." });
  }
  if (error.name === "SequelizeForeignKeyConstraintError") {
    return res.status(409).json({ error: "The request conflicts with related data." });
  }
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ error: "That username is already in use." });
  }
  console.error("API request failed:", error);
  if (error.statusCode === 502 || error.statusCode === 503) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
