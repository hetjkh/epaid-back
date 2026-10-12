require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Admin = require("../models/Admin");
const { hashPassword } = require("../utils/password");

/**
 * Usage: npm run create-admin -- <email> <password>
 * Creates the admin, or resets the password if the email already exists.
 */
async function main() {
  const [emailArg, password] = process.argv.slice(2);
  const email = String(emailArg ?? "").trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) {
    console.error("Usage: npm run create-admin -- <email> <password>");
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  await connectDB();

  const passwordHash = await hashPassword(password);
  const existing = await Admin.findOne({ email });

  if (existing) {
    existing.passwordHash = passwordHash;
    await existing.save();
    console.log(`Password updated for admin ${email}`);
  } else {
    await Admin.create({ email, passwordHash });
    console.log(`Admin created: ${email}`);
  }
}

main()
  .catch((error) => {
    console.error("Create admin failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
