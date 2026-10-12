const express = require("express");
const mongoose = require("mongoose");
const TeamMember = require("../models/TeamMember");
const { requireAuth } = require("../middleware/auth");
const {
  uploadImageBuffer,
  deleteImage,
  imageUpload,
  handleUpload,
} = require("../utils/uploadImage");
const { sendError } = require("../utils/httpError");

const router = express.Router();

router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Team member not found" });
  }
  next();
});

const memberImage = handleUpload(imageUpload.single("image"));

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSortOrder(raw) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

router.get("/", async (_req, res) => {
  try {
    const members = await TeamMember.find().sort({ sortOrder: 1, createdAt: 1 }).lean();
    res.json({ members });
  } catch (error) {
    console.error("Fetch team members error:", error);
    res.status(500).json({ message: "Failed to fetch team members" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id).lean();
    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }
    res.json({ member });
  } catch (error) {
    console.error("Fetch team member error:", error);
    res.status(500).json({ message: "Failed to fetch team member" });
  }
});

router.post("/", requireAuth, memberImage, async (req, res) => {
  try {
    const name = text(req.body.name);
    const role = text(req.body.role);

    if (!name || !role) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    const image = await uploadImageBuffer(req.file.buffer, req.file.mimetype, "team");

    const member = await TeamMember.create({
      name,
      role,
      image,
      sortOrder: parseSortOrder(req.body.sortOrder),
    });

    res.status(201).json({ message: "Team member created", member });
  } catch (error) {
    console.error("Create team member error:", error);
    sendError(res, error, "Failed to create team member");
  }
});

router.put("/:id", requireAuth, memberImage, async (req, res) => {
  try {
    const member = await TeamMember.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Team member not found" });
    }

    const name = text(req.body.name);
    const role = text(req.body.role);

    if (!name || !role) {
      return res.status(400).json({ message: "Name and role are required" });
    }

    if (req.file) {
      const uploaded = await uploadImageBuffer(req.file.buffer, req.file.mimetype, "team");
      if (member.image?.publicId) {
        await deleteImage(member.image.publicId);
      }
      member.image = uploaded;
    }

    member.name = name;
    member.role = role;
    member.sortOrder = parseSortOrder(req.body.sortOrder);

    await member.save();

    res.json({ message: "Team member updated", member });
  } catch (error) {
    console.error("Update team member error:", error);
    sendError(res, error, "Failed to update team member");
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
