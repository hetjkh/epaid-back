const express = require("express");
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const { uploadImageBuffer } = require("../utils/uploadImage");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

router.post("/", requireAuth, (req, res) => {
  upload.single("image")(req, res, async (err) => {
    if (err) {
      const message =
        err.code === "LIMIT_FILE_SIZE" ? "Image must be 8MB or smaller" : err.message;
      return res.status(400).json({ message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    try {
      const image = await uploadImageBuffer(req.file.buffer, req.file.mimetype, "content");
      res.status(201).json({ message: "Image uploaded", image });
    } catch (error) {
      console.error("Upload image error:", error);
      res.status(400).json({ message: error.message || "Failed to upload image" });
    }
  });
});

module.exports = router;
