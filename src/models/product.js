const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("./branch");

const Product = sequelize.define("Product", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(180),
    allowNull: false,
  },
  barcode: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  branchId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: "branches", key: "id" },
    onDelete: "RESTRICT",
  },
  status: {
    type: DataTypes.ENUM("pending", "di_gudang", "di_toko", "di_spg", "di_collecting", "terjual", "rusak"),
    allowNull: false,
    defaultValue: "pending",
  },
}, {
  tableName: "products",
  timestamps: true,
});

Product.belongsTo(Branch, { as: "branchRecord", foreignKey: "branchId" });

module.exports = Product;
