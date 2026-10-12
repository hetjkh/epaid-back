const express = require("express");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const AdminSession = require("../models/AdminSession");
const { requireAuth } = require("../middleware/auth");
const { verifyPassword } = require("../utils/password");

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const email = String(req.body.email ?? req.body.id ?? "").trim().toLowerCase();
    const { password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("Login error: JWT_SECRET is not set in .env");
      return res.status(500).json({ message: "Server is not configured for login" });
    }

    const admin = await Admin.findOne({ email });
    const valid = admin ? await verifyPassword(password, admin.passwordHash) : false;

    if (!valid) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
    const token = jwt.sign(
      { id: admin.email, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn }
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await AdminSession.create({
      adminId: admin.email,
      token,
      expiresAt,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });

    return res.json({
      message: "Login successful",
      token,
      admin: { id: admin.email, email: admin.email, role: admin.role },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error during login" });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ admin: req.admin });
});

router.post("/logout", requireAuth, async (req, res) => {
  try {
    await AdminSession.updateOne({ token: req.token }, { revoked: true });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
});

module.exports = router;
