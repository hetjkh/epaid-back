const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const { HttpError } = require("./httpError");

/** In production set UPLOADS_DIR to a folder outside the app (e.g. /var/www/epaid-uploads) so redeploys keep the images. */
const UPLOADS_DIR = path.resolve(
  process.env.UPLOADS_DIR?.trim() || path.join(__dirname, "..", "uploads")
);

/** File type is detected from the file's bytes — the browser-sent mimetype can't be trusted. */
function detectImageExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  const ascii = (start, end) => buffer.toString("ascii", start, end);

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return ".jpg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return ".png";
  }
  if (ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a") return ".gif";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return ".webp";
  if (ascii(4, 8) === "ftyp" && ["avif", "avis"].includes(ascii(8, 12))) return ".avif";
  return null;
}

async function uploadImageBuffer(buffer, _mimetype, folder = "products") {
  const ext = detectImageExtension(buffer);
  if (!ext) {
    throw new HttpError(400, "Unsupported image type. Use JPG, PNG, WEBP, GIF, or AVIF.");
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

const MAX_IMAGE_MB = 8;

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_MB * 1024 * 1024, files: 5, fields: 20, fieldSize: 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new HttpError(400, "Only image files are allowed"));
    }
  },
});

/** Wraps a multer middleware so upload problems return a clear 400 instead of a crash page. */
function handleUpload(middleware) {
  return (req, res, next) => {
    middleware(req, res, (err) => {
      if (!err) return next();
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? `Image must be ${MAX_IMAGE_MB}MB or smaller`
          : err instanceof HttpError || err instanceof multer.MulterError
            ? err.message
            : "Upload failed";
      res.status(400).json({ message });
    });
  };
}

module.exports = { uploadImageBuffer, deleteImage, imageUpload, handleUpload, UPLOADS_DIR };
