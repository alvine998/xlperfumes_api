const cors = require("cors");
const express = require("express");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

app.get("/", (_req, res) => {
  res.json({ message: "XL Perfumes API is running" });
});

module.exports = app;
