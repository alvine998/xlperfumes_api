const cors = require("cors");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
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
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api-docs.json", (_req, res) => {
  res.json(openapiSpec);
});

app.get("/", (_req, res) => {
  res.json({ message: "XL Perfumes API is running" });
});

app.use((error, _req, res, _next) => {
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({ error: "That username is already in use." });
  }
  console.error("API request failed:", error);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
