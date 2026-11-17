require("dotenv").config();

const app = require("./app");
const sequelize = require("./config/database");
const { getJwtSecret } = require("./middleware/authenticate");

const port = Number(process.env.PORT) || 4000;

async function startServer() {
  try {
    getJwtSecret();
    await sequelize.authenticate();
    await sequelize.sync();
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
