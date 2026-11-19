const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StoreZona = sequelize.define("StoreZona", {
  storeId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
    references: {
      model: "stores",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  zonaId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: {
      model: "zonas",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  routeIndex: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
}, {
  tableName: "store_zonas",
  indexes: [{ fields: ["zonaId", "routeIndex"] }],
  timestamps: true,
});

module.exports = StoreZona;
