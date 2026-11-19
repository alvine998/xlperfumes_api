const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");
const User = require("./user");

const UserZona = sequelize.define("UserZona", {
  zonaId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
    field: "zona_id",
    references: {
      model: "zonas",
      key: "id",
    },
    onDelete: "CASCADE",
  },
  userId: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
    field: "user_id",
    references: {
      model: "users",
      key: "id",
    },
    onDelete: "CASCADE",
  },
}, {
  tableName: "user_zona",
  timestamps: false,
});

UserZona.belongsTo(User, { as: "user", foreignKey: "userId" });

module.exports = UserZona;
