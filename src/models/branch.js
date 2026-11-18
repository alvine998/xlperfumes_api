const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const Branch = sequelize.define("Branch", {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: false,
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
  tableName: "branches",
  timestamps: true,
});

Branch.belongsTo(User, { as: "creator", foreignKey: "createdBy" });

module.exports = Branch;
