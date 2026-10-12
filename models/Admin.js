const mongoose = require("mongoose");

/** "admin" can do everything including managing users; "editor" can edit content only. */
const ROLES = ["admin", "editor"];

const adminSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    name: { type: String, trim: true, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ROLES, default: "admin" },
    lastLoginAt: { type: Date },
    createdBy: { type: String },
  },
  { timestamps: true }
);

const Admin = mongoose.model("Admin", adminSchema);
Admin.ROLES = ROLES;

module.exports = Admin;
