const { DataTypes } = require("sequelize");
const { addColumnIfMissing } = require("./helpers");

const tableName = "zonas";
const columnName = "user_pic_id";

async function up({ context: queryInterface }) {
  await addColumnIfMissing(queryInterface, tableName, columnName, {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "users", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
}

async function down({ context: queryInterface }) {
  const columns = await queryInterface.describeTable(tableName);
  if (columns[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

module.exports = { down, up };
