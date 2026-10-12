const express = require("express");
const mongoose = require("mongoose");
const Admin = require("../models/Admin");
const AdminSession = require("../models/AdminSession");
const { requireAuth, requireRole } = require("../middleware/auth");
const { hashPassword } = require("../utils/password");

const router = express.Router();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;
const MAX_PASSWORD = 256;

router.use(requireAuth, requireRole("admin"));

router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "User not found" });
  }
  next();
});

function toPublic(admin) {
  return {
    _id: admin._id,
    email: admin.email,
    name: admin.name || "",
    role: admin.role,
    lastLoginAt: admin.lastLoginAt || null,
    createdAt: admin.createdAt,
    createdBy: admin.createdBy || null,
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function passwordError(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) {
    return `Password must be at least ${MIN_PASSWORD} characters`;
  }
  if (password.length > MAX_PASSWORD) return "Password is too long";
  return null;
}

/** Signs the user out everywhere, e.g. after a password or role change. */
function revokeSessions(email) {
  return AdminSession.updateMany({ adminId: email, revoked: false }, { revoked: true });
}

async function isLastAdmin(admin) {
  if (admin.role !== "admin") return false;
  return (await Admin.countDocuments({ role: "admin" })) <= 1;
}

router.get("/", async (_req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: 1 }).lean();
    res.json({ users: admins.map(toPublic) });
  } catch (error) {
    console.error("List users error:", error);
    res.status(500).json({ message: "Failed to load users" });
  }
});

router.post("/", async (req, res) => {
  try {
    const email = text(req.body?.email).toLowerCase();
    const name = text(req.body?.name).slice(0, 100);
    const role = text(req.body?.role) || "editor";
    const { password } = req.body ?? {};

    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }
    if (!Admin.ROLES.includes(role)) {
      return res.status(400).json({ message: "Unknown role" });
    }
    const pwError = passwordError(password);
    if (pwError) return res.status(400).json({ message: pwError });

    if (await Admin.exists({ email })) {
      return res.status(409).json({ message: "A user with this email already exists" });
    }

    const admin = await Admin.create({
      email,
      name,
      role,
      passwordHash: await hashPassword(password),
      createdBy: req.admin.email,
    });

    res.status(201).json({ message: "User created", user: toPublic(admin) });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ message: "Failed to create user" });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "User not found" });

    const isSelf = admin.email === req.admin.email;
    let signOut = false;

    if (req.body?.name !== undefined) {
      admin.name = text(req.body.name).slice(0, 100);
    }

    if (req.body?.role !== undefined) {
      const role = text(req.body.role);
      if (!Admin.ROLES.includes(role)) {
        return res.status(400).json({ message: "Unknown role" });
      }
      if (role !== admin.role) {
        if (isSelf) {
          return res.status(400).json({ message: "You can't change your own role" });
        }
        if (await isLastAdmin(admin)) {
          return res.status(400).json({ message: "There must be at least one admin" });
        }
        admin.role = role;
        signOut = true;
      }
    }

    if (req.body?.password !== undefined) {
      const pwError = passwordError(req.body.password);
      if (pwError) return res.status(400).json({ message: pwError });
      admin.passwordHash = await hashPassword(req.body.password);
      signOut = !isSelf || signOut;
    }

    await admin.save();
    if (signOut) await revokeSessions(admin.email);

    res.json({ message: "User updated", user: toPublic(admin) });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ message: "Failed to update user" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "User not found" });

    if (admin.email === req.admin.email) {
      return res.status(400).json({ message: "You can't delete your own account" });
    }
    if (await isLastAdmin(admin)) {
      return res.status(400).json({ message: "There must be at least one admin" });
    }

    await admin.deleteOne();
    await revokeSessions(admin.email);
    res.json({ message: "User deleted" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ message: "Failed to delete user" });
  }
});

module.exports = router;
