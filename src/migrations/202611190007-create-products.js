const { DataTypes } = require("sequelize");
const { hasTable } = require("./helpers");

const tableName = "products";
const statuses = ["pending", "di_gudang", "di_toko", "di_spg", "di_collecting", "terjual", "rusak"];

async function up({ context: queryInterface }) {
  if (await hasTable(queryInterface, tableName)) return;
  await queryInterface.createTable(tableName, {
    id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING(180), allowNull: false },
    barcode: { type: DataTypes.STRING(120), allowNull: false, unique: true },
    branchId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: { model: "branches", key: "id" },
      onUpdate: "CASCADE",
      onDelete: "RESTRICT",
    },
    status: { type: DataTypes.ENUM(...statuses), allowNull: false, defaultValue: "pending" },
    createdAt: { type: DataTypes.DATE, allowNull: false },
    updatedAt: { type: DataTypes.DATE, allowNull: false },
  });
}

async function down({ context: queryInterface }) {
  if (await hasTable(queryInterface, tableName)) await queryInterface.dropTable(tableName);
}

module.exports = { down, up };
