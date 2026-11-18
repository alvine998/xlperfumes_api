const ActivityLog = require("../models/activity-log");

async function logActivity(req, {
  action,
  entityType,
  entityId = null,
  details = null,
  user = req?.user,
  username,
}) {
  try {
    await ActivityLog.create({
      userId: user?.id ?? null,
      username: username ?? user?.username ?? null,
      action,
      entityType,
      entityId: entityId === null || entityId === undefined ? null : String(entityId),
      details,
      ipAddress: req?.ip?.slice(0, 45) ?? null,
      userAgent: req?.get?.("user-agent")?.slice(0, 65535) ?? null,
    });
  } catch (error) {
    console.error("Unable to write activity log:", error);
  }
}

module.exports = logActivity;
