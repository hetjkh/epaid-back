const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

/** In production set UPLOADS_DIR to a folder outside the app (e.g. /var/www/epaid-uploads) so redeploys keep the images. */
const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR?.trim() || path.join(__dirname, "..", "uploads")
);

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

async function uploadImageBuffer(buffer, mimetype, folder = "products") {
  const ext = EXTENSIONS[mimetype];
  if (!ext) {
    throw new Error("Unsupported image type. Use JPG, PNG, WEBP, GIF, or AVIF.");
  }
  const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}${ext}`;
  const dir = path.join(UPLOADS_DIR, folder);

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);

  const publicId = `${folder}/${filename}`;
  return {
    url: `/uploads/${publicId}`,
    publicId,
  };
}

/** Only files inside the uploads dir are deleted; seeded/static images are left alone. */
async function deleteImage(publicId) {
  if (!publicId) return;

  const filePath = path.resolve(UPLOADS_DIR, publicId);
  if (!filePath.startsWith(UPLOADS_DIR + path.sep)) return;

  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.warn("Image delete warning:", publicId, err.message);
    }
  }
}

module.exports = { uploadImageBuffer, deleteImage, UPLOADS_DIR };
