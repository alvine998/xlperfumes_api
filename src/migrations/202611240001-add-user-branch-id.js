const { DataTypes } = require("sequelize");
const { addColumnIfMissing, hasTable } = require("./helpers");

const tableName = "users";
const columnName = "branchId";

async function up({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) return;
  await addColumnIfMissing(queryInterface, tableName, columnName, {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "branches", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
}

async function down({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) return;
  const columns = await queryInterface.describeTable(tableName);
  if (columns[columnName]) await queryInterface.removeColumn(tableName, columnName);
}

module.exports = { down, up };
