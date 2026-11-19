require("dotenv").config();

const { DataTypes } = require("sequelize");
const app = require("./app");
const sequelize = require("./config/database");
const { getJwtSecret } = require("./middleware/authenticate");
const { runMigrations } = require("./migrations");

const port = Number(process.env.PORT) || 4000;

async function ensureStoreBranchId() {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("stores");
  if (columns.branchId) return;

  await queryInterface.addColumn("stores", "branchId", {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: "branches",
      key: "id",
    },
    onUpdate: "CASCADE",
    onDelete: "RESTRICT",
  });
}

async function startServer() {
  try {
    getJwtSecret();
    await sequelize.authenticate();
    await sequelize.sync();
    await ensureStoreBranchId();
    await runMigrations();
    console.log("MySQL connection established successfully.");

    app.listen(port, () => {
      console.log(`API server listening on port ${port}.`);
    });
  } catch (error) {
    console.error("Unable to start API server:", error);
    process.exitCode = 1;
  }
}

startServer();
