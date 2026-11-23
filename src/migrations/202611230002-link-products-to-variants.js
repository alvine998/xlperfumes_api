const { DataTypes } = require("sequelize");
const { hasTable } = require("./helpers");

const tableName = "products";

async function up({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName)) || !(await hasTable(queryInterface, "variants"))) return;
  let productColumns = await queryInterface.describeTable(tableName);
  if (!productColumns.variantId) {
    await queryInterface.addColumn(tableName, "variantId", {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
      references: { model: "variants", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    });
    productColumns = await queryInterface.describeTable(tableName);
  }

  if (productColumns.name) {
    await queryInterface.sequelize.query(
      "UPDATE `products` AS p " +
      "INNER JOIN (SELECT `name`, `branchId`, MIN(`id`) AS `id` FROM `variants` " +
      "WHERE `branchId` IS NOT NULL GROUP BY `name`, `branchId`) AS v " +
      "ON v.`name` = p.`name` AND v.`branchId` = p.`branchId` " +
      "SET p.`variantId` = v.`id` WHERE p.`variantId` IS NULL",
    );
    await queryInterface.sequelize.query(
      "UPDATE `products` AS p " +
      "INNER JOIN (SELECT `name`, MIN(`id`) AS `id` FROM `variants` " +
      "WHERE `branchId` IS NULL GROUP BY `name`) AS v " +
      "ON v.`name` = p.`name` " +
      "SET p.`variantId` = v.`id` WHERE p.`variantId` IS NULL",
    );
    await queryInterface.changeColumn(tableName, "name", {
      type: DataTypes.STRING(180),
      allowNull: true,
    });
  }
}

async function down({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) return;
  const columns = await queryInterface.describeTable(tableName);
  if (!columns.variantId) return;

  if (columns.name && await hasTable(queryInterface, "variants")) {
    await queryInterface.sequelize.query(
      "UPDATE `products` AS p " +
      "INNER JOIN `variants` AS v ON v.`id` = p.`variantId` " +
      "SET p.`name` = v.`name` WHERE p.`name` IS NULL",
    );
  }
  await queryInterface.removeColumn(tableName, "variantId");
}

module.exports = { down, up };
