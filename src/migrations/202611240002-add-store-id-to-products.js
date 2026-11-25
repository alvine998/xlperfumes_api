const { DataTypes } = require("sequelize");
const { hasTable, addColumnIfMissing } = require("./helpers");

const tableName = "products";

async function up({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName)) || !(await hasTable(queryInterface, "stores"))) return;
  await addColumnIfMissing(queryInterface, tableName, "storeId", {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "stores", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
}

async function down({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) return;
  const columns = await queryInterface.describeTable(tableName);
  if (columns.storeId) await queryInterface.removeColumn(tableName, "storeId");
}

module.exports = { down, up };
