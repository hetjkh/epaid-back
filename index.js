require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const teamRoutes = require("./routes/team");
const contentRoutes = require("./routes/content");
const uploadRoutes = require("./routes/uploads");
const adminRoutes = require("./routes/admins");
const { securityHeaders } = require("./middleware/security");
const { UPLOADS_DIR } = require("./utils/uploadImage");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.warn(
    "Warning: JWT_SECRET is missing or shorter than 32 characters. Use a long random value in production."
  );
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(securityHeaders);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
// Uploaded files get unique names and are never overwritten, so browsers can cache them for good.
app.use(
  "/uploads",
  express.static(UPLOADS_DIR, {
    maxAge: "365d",
    immutable: true,
    index: false,
    dotfiles: "deny",
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "e-paid-back" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/admins", adminRoutes);

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request is too large" });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ message: "Server error" });
});

async function start() {
  try {
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`e-paid-back running on http://localhost:${PORT}`);
      console.log(`Uploads stored in ${UPLOADS_DIR}`);
    });

    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Stop the other process or set PORT in .env`
        );
      } else {
        console.error("Server error:", error);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();
