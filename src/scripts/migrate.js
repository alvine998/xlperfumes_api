require("dotenv").config();

const sequelize = require("../config/database");
const { runMigrations, undoLastMigration } = require("../migrations");

async function migrate() {
  await sequelize.authenticate();
  if (process.argv.includes("--undo")) {
    await undoLastMigration();
    return;
  }
  await runMigrations();
}

migrate()
  .catch((error) => {
    console.error("Unable to run database migrations:", error);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
