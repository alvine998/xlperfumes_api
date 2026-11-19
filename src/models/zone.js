const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("./branch");
const User = require("./user");

const Zone = sequelize.define("Zone", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  branchId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: "branches",
      key: "id",
    },
    onDelete: "RESTRICT",
  },
  createdBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: "users",
      key: "id",
    },
    onDelete: "SET NULL",
  },
}, {
  tableName: "zonas",
  timestamps: true,
});

Zone.belongsTo(Branch, { as: "branchRecord", foreignKey: "branchId" });
Zone.belongsTo(User, { as: "creator", foreignKey: "createdBy" });

module.exports = Zone;
