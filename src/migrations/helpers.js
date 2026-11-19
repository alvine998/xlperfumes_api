function normalizeTableName(table) {
  return typeof table === "string" ? table : table.tableName ?? table.name;
}

async function hasTable(queryInterface, tableName) {
  const tables = await queryInterface.showAllTables();
  return tables.some(
    (table) => normalizeTableName(table).toLowerCase() === tableName.toLowerCase(),
  );
}

async function addColumnIfMissing(queryInterface, tableName, columnName, definition) {
  const columns = await queryInterface.describeTable(tableName);
  if (!columns[columnName]) {
    await queryInterface.addColumn(tableName, columnName, definition);
  }
}

module.exports = { addColumnIfMissing, hasTable };
