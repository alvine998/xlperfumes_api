const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("./branch");

const Variant = sequelize.define("Variant", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  quantity: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  unitPrice: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
  },
  branchId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "branches", key: "id" },
    onDelete: "RESTRICT",
  },
}, {
  tableName: "variants",
  timestamps: true,
});

Variant.belongsTo(Branch, { as: "branchRecord", foreignKey: "branchId" });

module.exports = Variant;
