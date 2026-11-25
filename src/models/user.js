const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  role: {
    type: DataTypes.ENUM("admin", "spg", "collecting", "gudang", "owner"),
    allowNull: false,
    defaultValue: "spg",
  },
  branchId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "branches", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: "is_active",
  },
}, {
  tableName: "users",
  defaultScope: {
    attributes: { exclude: ["password"] },
  },
  timestamps: true,
});

module.exports = User;
