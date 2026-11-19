const { DataTypes } = require("sequelize");
const { addColumnIfMissing } = require("./helpers");

const tableName = "stores";
const columnName = "zonaId";

async function up({ context: queryInterface }) {
  await addColumnIfMissing(queryInterface, tableName, columnName, {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "zonas", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  });
}

async function down({ context: queryInterface }) {
  const columns = await queryInterface.describeTable(tableName);
  if (columns[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

module.exports = { down, up };
