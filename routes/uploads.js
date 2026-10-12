const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { uploadImageBuffer, imageUpload, handleUpload } = require("../utils/uploadImage");
const { sendError } = require("../utils/httpError");

const router = express.Router();

router.post("/", requireAuth, handleUpload(imageUpload.single("image")), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image is required" });
  }

  try {
    const image = await uploadImageBuffer(req.file.buffer, req.file.mimetype, "content");
    res.status(201).json({ message: "Image uploaded", image });
  } catch (error) {
    console.error("Upload image error:", error);
    sendError(res, error, "Failed to upload image");
  }
});

module.exports = router;
