const { DataTypes } = require("sequelize");
const { hasTable } = require("./helpers");

const tableName = "variants";

async function up({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, {
      id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
      name: { type: DataTypes.STRING(150), allowNull: false },
      quantity: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
      unit: { type: DataTypes.STRING(40), allowNull: false },
      unitPrice: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
      branchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "branches", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false },
    });
  }
  const variantColumns = await queryInterface.describeTable(tableName);
  if (!variantColumns.branchId) {
    await queryInterface.addColumn(tableName, "branchId", {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "branches", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
  }

  if (!(await hasTable(queryInterface, "products"))) return;
  const productColumns = await queryInterface.describeTable("products");
  if (!productColumns.name || !productColumns.branchId) return;

  await queryInterface.sequelize.query(
    "UPDATE `variants` AS v " +
    "INNER JOIN (" +
    "SELECT `name`, MIN(`branchId`) AS `branchId` FROM `products` " +
    "WHERE `name` IS NOT NULL AND `branchId` IS NOT NULL " +
    "GROUP BY `name` HAVING COUNT(DISTINCT `branchId`) = 1" +
    ") AS p ON p.`name` = v.`name` " +
    "SET v.`branchId` = p.`branchId` WHERE v.`branchId` IS NULL",
  );
}

async function down({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) return;
  const columns = await queryInterface.describeTable(tableName);
  if (columns.branchId) await queryInterface.removeColumn(tableName, "branchId");
}

module.exports = { down, up };
