const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("./branch");
const Variant = require("./variant");

const Product = sequelize.define("Product", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
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
  storeId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "stores", key: "id" },
    onDelete: "SET NULL",
  },
  variantId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "variants", key: "id" },
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
Product.belongsTo(Variant, { as: "variantRecord", foreignKey: "variantId" });

module.exports = Product;
