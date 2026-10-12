const jwt = require("jsonwebtoken");
const AdminSession = require("../models/AdminSession");

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const session = await AdminSession.findOne({
      token,
      revoked: false,
      expiresAt: { $gt: new Date() },
    });

    if (!session) {
      return res.status(401).json({ message: "Session expired or invalid" });
    }

    req.admin = payload;
    req.token = token;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}

module.exports = { requireAuth };
