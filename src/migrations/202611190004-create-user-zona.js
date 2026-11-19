const { DataTypes } = require("sequelize");
const { hasTable } = require("./helpers");

const tableName = "user_zona";

async function up({ context: queryInterface }) {
  if (await hasTable(queryInterface, tableName)) return;

  await queryInterface.createTable(tableName, {
    zona_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true,
      references: { model: "zonas", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
    user_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      primaryKey: true,
      references: { model: "users", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
    },
  });
}

async function down({ context: queryInterface }) {
  if (await hasTable(queryInterface, tableName)) {
    await queryInterface.dropTable(tableName);
  }
}

module.exports = { down, up };
