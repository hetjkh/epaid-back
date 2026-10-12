const express = require("express");
const jwt = require("jsonwebtoken");
const Admin = require("../models/Admin");
const AdminSession = require("../models/AdminSession");
const { requireAuth, hashToken } = require("../middleware/auth");
const { createRateLimiter } = require("../middleware/security");
const { hashPassword, verifyPassword } = require("../utils/password");

const router = express.Router();
const dummyHash = hashPassword("not-a-real-password");

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many failed sign-in attempts. Please try again in 15 minutes.",
});

router.post("/login", loginLimiter.guard, async (req, res) => {
  try {
    const email = String(req.body?.email ?? req.body?.id ?? "").trim().toLowerCase();
    const password = typeof req.body?.password === "string" ? req.body.password : "";

    if (!email || !password || password.length > 256) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      console.error("Login error: JWT_SECRET is not set in .env");
      return res.status(500).json({ message: "Server is not configured for login" });
    }

    const admin = await Admin.findOne({ email });
    // Hash even for unknown emails so response time doesn't reveal which admins exist.
    const valid = await verifyPassword(password, admin ? admin.passwordHash : await dummyHash);
    if (!admin) {
      loginLimiter.fail(req);
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!valid) {
      loginLimiter.fail(req);
      return res.status(401).json({ message: "Invalid email or password" });
    }
    loginLimiter.reset(req);

    const token = jwt.sign(
      { id: admin.email, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d", algorithm: "HS256" }
    );
    const { exp } = jwt.decode(token);

    await AdminSession.create({
      adminId: admin.email,
      token: hashToken(token),
      expiresAt: new Date(exp * 1000),
      ip: req.ip,
      userAgent: String(req.get("user-agent") ?? "").slice(0, 300),
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
    await AdminSession.updateOne({ token: hashToken(req.token) }, { revoked: true });
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Server error during logout" });
  }
});

module.exports = router;
