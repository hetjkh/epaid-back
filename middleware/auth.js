const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AdminSession = require("../models/AdminSession");

/** Sessions store a hash of the token, so a database leak doesn't expose usable tokens. */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    const session = await AdminSession.exists({
      token: hashToken(token),
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

/** Use after requireAuth. */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.admin?.role)) {
      return res.status(403).json({ message: "You don't have permission to do this" });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, hashToken };
