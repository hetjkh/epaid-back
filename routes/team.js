const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const TeamMember = require("../models/TeamMember");
const { requireAuth } = require("../middleware/auth");
const { uploadImageBuffer, deleteImage } = require("../utils/uploadImage");

const router = express.Router();

router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Team member not found" });
  }
  next();
});

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

function parseSortOrder(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

router.get("/", async (_req, res) => {
  try {
    const members = await TeamMember.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json({ members });
  } catch (error) {
    console.error("Fetch team members error:", error);
    res.status(500).json({ message: "Failed to fetch team members" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }
    res.json({ member });
  } catch (error) {
    console.error("Fetch team member error:", error);
    res.status(500).json({ message: "Failed to fetch team member" });
  }
});

router.post("/", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const { name, role } = req.body;

    if (!name?.trim() || !role?.trim()) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const image = await uploadImageBuffer(
      req.file.buffer,
      req.file.mimetype,
      "team"
    );

    const member = await TeamMember.create({
      name: name.trim(),
      role: role.trim(),
      image,
      sortOrder: parseSortOrder(req.body.sortOrder),
    });

    res.status(201).json({ message: "Team member created", member });
  } catch (error) {
    console.error("Create team member error:", error);
    res.status(500).json({
      message: error.message || "Failed to create team member",
    });
  }
});

router.put("/:id", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    const { name, role } = req.body;

    if (!name?.trim() || !role?.trim()) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    if (req.file) {
      const uploaded = await uploadImageBuffer(
        req.file.buffer,
        req.file.mimetype,
        "team"
      );
      if (member.image?.publicId) {
        await deleteImage(member.image.publicId);
      }
      member.image = uploaded;
    }

    member.name = name.trim();
    member.role = role.trim();
    member.sortOrder = parseSortOrder(req.body.sortOrder);

    await member.save();

    res.json({ message: "Team member updated", member });
  } catch (error) {
    console.error("Update team member error:", error);
    res.status(500).json({
      message: error.message || "Failed to update team member",
    });
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    if (member.image?.publicId) {
      await deleteImage(member.image.publicId);
    }

    await member.deleteOne();
    res.json({ message: "Team member deleted" });
  } catch (error) {
    console.error("Delete team member error:", error);
    res.status(500).json({ message: "Failed to delete team member" });
  }
});

module.exports = router;
