const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const StoreStock = sequelize.define("StoreStock", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  storeId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: "stores",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  variantId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: "variants",
      key: "id",
    },
    onDelete: "RESTRICT",
  },
  totalStock: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
  updatedBy: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: "users",
      key: "id",
    },
    onDelete: "SET NULL",
  },
}, {
  tableName: "store_variant_stocks",
  indexes: [{
    unique: true,
    fields: ["storeId", "variantId"],
  }],
  timestamps: true,
});

StoreStock.belongsTo(User, { as: "updater", foreignKey: "updatedBy" });

module.exports = StoreStock;
