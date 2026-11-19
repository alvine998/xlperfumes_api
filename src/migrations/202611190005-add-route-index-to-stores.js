const { DataTypes } = require("sequelize");
const { addColumnIfMissing } = require("./helpers");

const tableName = "stores";
const columnName = "routeIndex";

async function up({ context: queryInterface }) {
  await addColumnIfMissing(queryInterface, tableName, columnName, {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  });
}

async function down({ context: queryInterface }) {
  const columns = await queryInterface.describeTable(tableName);
  if (columns[columnName]) {
    await queryInterface.removeColumn(tableName, columnName);
  }
}

module.exports = { down, up };
