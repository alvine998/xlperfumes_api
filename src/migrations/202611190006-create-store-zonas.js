const { DataTypes } = require("sequelize");
const { hasTable } = require("./helpers");

const tableName = "store_zonas";

async function up({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, {
      storeId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        primaryKey: true,
        references: { model: "stores", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      zonaId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "zonas", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "CASCADE",
      },
      routeIndex: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex(tableName, ["zonaId", "routeIndex"]);
  }

  const columns = await queryInterface.describeTable("stores");
  if (columns.zonaId) {
    await queryInterface.sequelize.query(
      `INSERT IGNORE INTO \`${tableName}\` (\`storeId\`, \`zonaId\`, \`routeIndex\`, \`createdAt\`, \`updatedAt\`)
       SELECT \`id\`, \`zonaId\`, \`routeIndex\` + 1, NOW(), NOW()
       FROM \`stores\`
       WHERE \`zonaId\` IS NOT NULL`,
    );
    await queryInterface.sequelize.query(
      "UPDATE `stores` SET `zonaId` = NULL, `routeIndex` = 0 WHERE `zonaId` IS NOT NULL",
    );
  }
}

async function down({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) return;
  const columns = await queryInterface.describeTable("stores");
  if (columns.zonaId && columns.routeIndex) {
    await queryInterface.sequelize.query(
      `UPDATE \`stores\` AS s
       INNER JOIN \`${tableName}\` AS sz ON sz.\`storeId\` = s.\`id\`
       SET s.\`zonaId\` = sz.\`zonaId\`, s.\`routeIndex\` = sz.\`routeIndex\` - 1`,
    );
  }
  await queryInterface.dropTable(tableName);
}

module.exports = { down, up };
