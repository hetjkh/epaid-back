const express = require("express");
const SiteContent = require("../models/SiteContent");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_KEYS = new Set(["home", "about", "solutions", "blogs"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

router.param("key", (req, res, next, key) => {
  if (!ALLOWED_KEYS.has(key)) {
    return res.status(404).json({ message: "Unknown content section" });
  }
  next();
});

router.get("/:key", async (req, res) => {
  try {
    const doc = await SiteContent.findOne({ key: req.params.key }).lean();
    if (!doc) {
      return res.status(404).json({ message: "Content not set yet" });
    }
    res.json({ content: { en: doc.en, ar: doc.ar }, updatedAt: doc.updatedAt });
  } catch (error) {
    console.error("Fetch content error:", error);
    res.status(500).json({ message: "Failed to fetch content" });
  }
});

router.put("/:key", requireAuth, async (req, res) => {
  try {
    const { en, ar } = req.body ?? {};

    if (!isPlainObject(en) || !isPlainObject(ar)) {
      return res
        .status(400)
        .json({ message: "Both English (en) and Arabic (ar) content are required" });
    }

    const doc = await SiteContent.findOneAndUpdate(
      { key: req.params.key },
      { en, ar, updatedBy: req.admin?.email || req.admin?.id },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    res.json({
      message: "Content saved",
      content: { en: doc.en, ar: doc.ar },
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error("Save content error:", error);
    res.status(500).json({ message: "Failed to save content" });
  }
});

module.exports = router;
