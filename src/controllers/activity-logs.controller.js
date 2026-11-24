const ActivityLog = require("../models/activity-log");
const sequelize = require("../config/database");
const { Op } = require("sequelize");
const { paginationFromQuery, paginationMetadata } = require("../utils/pagination");

function parseDateOnly(value, endOfDay = false) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const normalized = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(normalized.getTime()) || normalized.toISOString().slice(0, 10) !== value) return null;
  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function listActivityLogs(req, res) {
  const pagination = paginationFromQuery(req.query, { defaultLimit: 100, maxLimit: 500 });
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const where = {};
  if (typeof req.query.action === "string" && req.query.action) where.action = req.query.action;
  if (typeof req.query.username === "string" && req.query.username) where.username = req.query.username;
  if (typeof req.query.branch === "string" && req.query.branch) {
    if (req.query.branch === "Tanpa cabang") {
      where[Op.and] = [
        sequelize.where(sequelize.json("details.branch"), null),
      ];
    } else {
      where[Op.and] = [sequelize.where(sequelize.json("details.branch"), req.query.branch)];
    }
  }
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  if (startDate !== undefined) {
    const start = parseDateOnly(startDate);
    if (!start) return res.status(400).json({ error: "Tanggal mulai tidak valid." });
    where.createdAt = { ...where.createdAt, [Op.gte]: start };
  }
  if (endDate !== undefined) {
    const end = parseDateOnly(endDate);
    if (!end) return res.status(400).json({ error: "Tanggal akhir tidak valid." });
    const exclusiveEnd = new Date(end);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    where.createdAt = { ...where.createdAt, [Op.lt]: exclusiveEnd };
  }
  if (startDate && endDate && startDate > endDate) {
    return res.status(400).json({ error: "Rentang tanggal tidak valid." });
  }
  if (typeof req.query.search === "string" && req.query.search.trim()) {
    const search = `%${req.query.search.trim().replace(/[\\%_]/g, "\\$&")}%`;
    where[Op.or] = [
      { username: { [Op.like]: search } },
      { action: { [Op.like]: search } },
      { entityType: { [Op.like]: search } },
      { entityId: { [Op.like]: search } },
      { ipAddress: { [Op.like]: search } },
      sequelize.where(sequelize.cast(sequelize.col("details"), "CHAR"), { [Op.like]: search }),
    ];
  }
  const options = {
    where,
    order: [["createdAt", "DESC"]],
  };
  const result = pagination
    ? await ActivityLog.findAndCountAll({
      ...options,
      limit: pagination.limit,
      offset: pagination.offset,
    })
    : { rows: await ActivityLog.findAll({ ...options, limit }), count: null };
  const payload = { activityLogs: result.rows };
  if (pagination) payload.pagination = paginationMetadata(pagination, result.count);
  if (req.query.includeOptions === "true") {
    const latestLogs = await ActivityLog.findAll({
      attributes: ["username", "action", "details"],
      order: [["createdAt", "DESC"]],
      limit: 500,
    });
    payload.filters = {
      users: [...new Set(latestLogs.map(({ username }) => username).filter(Boolean))].sort(),
      actions: [...new Set(latestLogs.map(({ action }) => action))].sort(),
      branches: [...new Set(latestLogs.map(({ details }) =>
        details && typeof details === "object" && typeof details.branch === "string" && details.branch.trim()
          ? details.branch
          : "Tanpa cabang",
      ))].sort(),
    };
  }
  res.json(payload);
}

module.exports = { listActivityLogs };
