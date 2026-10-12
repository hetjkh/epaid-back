const express = require("express");
const SiteContent = require("../models/SiteContent");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_KEYS = new Set([
  "home",
  "about",
  "solutions",
  "blogs",
  "contact",
  "partnerships",
  "footer",
]);

const MAX_DEPTH = 12;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Keeps only JSON-safe values, drops keys MongoDB treats specially ($…, dotted),
 * and blanks script URLs so a stolen admin session can't plant links that run code.
 */
function cleanContent(value, depth = 0) {
  if (depth > MAX_DEPTH) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => cleanContent(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const [key, child] of Object.entries(value)) {
      if (key.startsWith("$") || key.includes(".") || UNSAFE_KEYS.has(key)) continue;
      const cleaned = cleanContent(child, depth + 1);
      if (cleaned !== undefined) out[key] = cleaned;
    }
    return out;
  }
  if (typeof value === "string") {
    return /^\s*(javascript:|vbscript:|data:text\/html)/i.test(value) ? "" : value;
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) return value;
  return undefined;
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
      { en: cleanContent(en), ar: cleanContent(ar), updatedBy: req.admin?.email || req.admin?.id },
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
