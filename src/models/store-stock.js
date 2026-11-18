const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StoreStock = sequelize.define("StoreStock", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  storeId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    unique: true,
    references: {
      model: "stores",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  totalStock: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  tableName: "store_stocks",
  timestamps: true,
});

module.exports = StoreStock;
