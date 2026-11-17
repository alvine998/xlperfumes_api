const cors = require("cors");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapiSpec = require("./docs/openapi");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));
app.get("/api-docs.json", (_req, res) => {
  res.json(openapiSpec);
});

app.get("/", (_req, res) => {
  res.json({ message: "XL Perfumes API is running" });
});

module.exports = app;
