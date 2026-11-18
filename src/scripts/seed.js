require("dotenv").config();

const bcrypt = require("bcryptjs");
const sequelize = require("../config/database");
const User = require("../models/user");

async function seed() {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || username.length < 3 || username.length > 50) {
    throw new Error("Set ADMIN_USERNAME to a value between 3 and 50 characters.");
  }
  if (!password || password.length < 8 || Buffer.byteLength(password, "utf8") > 72) {
    throw new Error("Set ADMIN_PASSWORD to a password of 8-72 UTF-8 bytes.");
  }

  await sequelize.authenticate();
  await sequelize.sync();

  const [user, created] = await User.findOrCreate({
    where: { username },
    defaults: {
      password: await bcrypt.hash(password, 12),
      role: "admin",
      isActive: true,
    },
  });

  if (!created && (user.role !== "admin" || !user.isActive)) {
    user.role = "admin";
    user.isActive = true;
    await user.save();
  }

  console.log(created
    ? `Seeded administrator "${username}".`
    : `Administrator "${username}" is already seeded.`);
}

seed()
  .catch((error) => {
    console.error("Unable to seed database:", error.message);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
