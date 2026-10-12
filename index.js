require("dotenv").config();

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/auth");
const productRoutes = require("./routes/products");
const teamRoutes = require("./routes/team");
const contentRoutes = require("./routes/content");
const uploadRoutes = require("./routes/uploads");
const { UPLOADS_DIR } = require("./utils/uploadImage");

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

app.set("trust proxy", 1);
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use("/uploads", express.static(UPLOADS_DIR, { maxAge: "7d" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "e-paid-back" });
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/team", teamRoutes);
app.use("/api/content", contentRoutes);
app.use("/api/uploads", uploadRoutes);

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
