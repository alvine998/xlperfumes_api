const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const Branch = require("./branch");
const User = require("./user");
const UserZona = require("./user-zona");

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
  userPicId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    field: "user_pic_id",
    references: {
      model: "users",
      key: "id",
    },
    onDelete: "SET NULL",
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
Zone.belongsTo(User, { as: "pic", foreignKey: "userPicId" });
Zone.belongsToMany(User, {
  as: "members",
  through: UserZona,
  foreignKey: "zonaId",
  otherKey: "userId",
});

module.exports = Zone;
