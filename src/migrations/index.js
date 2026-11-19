const { DataTypes, QueryTypes } = require("sequelize");
const sequelize = require("../config/database");
const { hasTable } = require("./helpers");
const migrations = [
  ["202611190001-create-zonas", require("./202611190001-create-zonas")],
  ["202611190002-add-user-pic-to-zonas", require("./202611190002-add-user-pic-to-zonas")],
  ["202611190003-add-zona-id-to-stores", require("./202611190003-add-zona-id-to-stores")],
  ["202611190004-create-user-zona", require("./202611190004-create-user-zona")],
  ["202611190005-add-route-index-to-stores", require("./202611190005-add-route-index-to-stores")],
  ["202611190006-create-store-zonas", require("./202611190006-create-store-zonas")],
];

const queryInterface = sequelize.getQueryInterface();
const metaTable = "SequelizeMeta";

async function ensureMetaTable() {
  if (!(await hasTable(queryInterface, metaTable))) {
    await queryInterface.createTable(metaTable, {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
      },
    });
  }
}

async function appliedMigrations() {
  await ensureMetaTable();
  const rows = await sequelize.query(
    "SELECT `name` FROM `SequelizeMeta`",
    { type: QueryTypes.SELECT },
  );
  return new Set(rows.map(({ name }) => name));
}

async function runMigrations() {
  const applied = await appliedMigrations();
  for (const [name, migration] of migrations) {
    if (applied.has(`${name}.js`)) continue;
    await migration.up({ context: queryInterface });
    await queryInterface.bulkInsert(metaTable, [{ name: `${name}.js` }]);
    console.log(`Applied migration ${name}.js`);
  }
}

async function undoLastMigration() {
  const applied = await appliedMigrations();
  for (const [name, migration] of [...migrations].reverse()) {
    const fileName = `${name}.js`;
    if (!applied.has(fileName)) continue;
    await migration.down({ context: queryInterface });
    await queryInterface.bulkDelete(metaTable, { name: fileName });
    console.log(`Reverted migration ${fileName}`);
    return;
  }
  console.log("No migrations to revert.");
}

module.exports = { runMigrations, undoLastMigration };
