const { DataTypes } = require("sequelize");
const { addColumnIfMissing, hasTable } = require("./helpers");

const tableName = "zonas";

async function up({ context: queryInterface }) {
  if (!(await hasTable(queryInterface, tableName))) {
    await queryInterface.createTable(tableName, {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      branchId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: { model: "branches", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "RESTRICT",
      },
      createdBy: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: { model: "users", key: "id" },
        onUpdate: "CASCADE",
        onDelete: "SET NULL",
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });
    return;
  }

  await addColumnIfMissing(queryInterface, tableName, "name", {
    type: DataTypes.STRING(120),
    allowNull: false,
  });
  await addColumnIfMissing(queryInterface, tableName, "branchId", {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    references: { model: "branches", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  });
  await addColumnIfMissing(queryInterface, tableName, "createdBy", {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: { model: "users", key: "id" },
    onUpdate: "CASCADE",
    onDelete: "SET NULL",
  });
  await addColumnIfMissing(queryInterface, tableName, "createdAt", {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  });
  await addColumnIfMissing(queryInterface, tableName, "updatedAt", {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  });
}

async function down({ context: queryInterface }) {
  if (await hasTable(queryInterface, tableName)) {
    await queryInterface.dropTable(tableName);
  }
}

module.exports = { down, up };
