const mongoose = require("mongoose");

const adminSessionSchema = new mongoose.Schema(
  {
    adminId: { type: String, required: true },
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    ip: { type: String },
    userAgent: { type: String },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

adminSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AdminSession", adminSessionSchema);
