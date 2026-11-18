const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

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
}, {
  tableName: "variants",
  timestamps: true,
});

module.exports = Variant;
