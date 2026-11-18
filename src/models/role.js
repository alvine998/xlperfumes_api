const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Role = sequelize.define("Role", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  slug: {
    type: DataTypes.ENUM("admin", "spg", "collecting", "gudang", "owner"),
    allowNull: false,
    unique: true,
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
  },
}, {
  tableName: "roles",
  timestamps: true,
});

module.exports = Role;
