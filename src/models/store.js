const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("./branch");
const Zone = require("./zone");

const Store = sequelize.define("Store", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  branch: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  branchId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: "branches",
      key: "id",
    },
    onDelete: "RESTRICT",
  },
  zonaId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: "zonas",
      key: "id",
    },
    onDelete: "RESTRICT",
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
  longitude: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
  },
}, {
  tableName: "stores",
  timestamps: true,
});

Store.belongsTo(Branch, { as: "branchRecord", foreignKey: "branchId" });
Store.belongsTo(Zone, { as: "zonaRecord", foreignKey: "zonaId" });

module.exports = Store;
