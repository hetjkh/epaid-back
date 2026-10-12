const mongoose = require("mongoose");

const siteContentSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    en: { type: mongoose.Schema.Types.Mixed, default: {} },
    ar: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: String },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("SiteContent", siteContentSchema);
