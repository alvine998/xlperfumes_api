const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ActivityLog = sequelize.define("ActivityLog", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: "user_id",
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  entityType: {
    type: DataTypes.STRING(50),
    allowNull: false,
    field: "entity_type",
  },
  entityId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: "entity_id",
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ipAddress: {
    type: DataTypes.STRING(45),
    allowNull: true,
    field: "ip_address",
  },
  userAgent: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: "user_agent",
  },
}, {
  tableName: "activity_logs",
  timestamps: true,
  updatedAt: false,
});

module.exports = ActivityLog;
