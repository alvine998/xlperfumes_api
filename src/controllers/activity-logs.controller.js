const ActivityLog = require("../models/activity-log");

async function listActivityLogs(req, res) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  const logs = await ActivityLog.findAll({
    order: [["createdAt", "DESC"]],
    limit,
  });
  res.json({ activityLogs: logs });
}

module.exports = { listActivityLogs };
