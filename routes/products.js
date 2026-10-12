const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const Product = require("../models/Product");
const { requireAuth } = require("../middleware/auth");
const { uploadImageBuffer, deleteImage } = require("../utils/uploadImage");
const { formatPrice } = require("../utils/formatPrice");

const router = express.Router();

router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Product not found" });
  }
  next();
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

function parseSpecifications(raw) {
  if (!raw) return [];

  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item?.label?.trim() && item?.value?.trim())
      .map((item) => ({
        label: item.label.trim(),
        value: item.value.trim(),
      }));
  } catch {
    return [];
  }
}

router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ products });
  } catch (error) {
    console.error("Fetch products error:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ product });
  } catch (error) {
    console.error("Fetch product error:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

router.post(
  "/",
  requireAuth,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 4 },
  ]),
  async (req, res) => {
    try {
      const { title, description, price } = req.body;

      if (!title?.trim() || !description?.trim() || !price?.trim()) {
        return res
          .status(400)
          .json({ message: "Title, description, and price are required" });
      }

      const mainFile = req.files?.mainImage?.[0];
      if (!mainFile) {
        return res.status(400).json({ message: "Main image is required" });
      }

      const mainImage = await uploadImageBuffer(mainFile.buffer, mainFile.mimetype);

      const galleryFiles = req.files?.galleryImages || [];
      const galleryImages = [];

      for (const file of galleryFiles) {
        const uploaded = await uploadImageBuffer(file.buffer, file.mimetype);
        galleryImages.push(uploaded);
      }

      const specifications = parseSpecifications(req.body.specifications);

      const product = await Product.create({
        title: title.trim(),
        description: description.trim(),
        price: formatPrice(price),
        mainImage,
        galleryImages,
        specifications,
      });

      res.status(201).json({ message: "Product created", product });
    } catch (error) {
      console.error("Create product error:", error);
      res.status(500).json({
        message: error.message || "Failed to create product",
      });
    }
  }
);

async function destroyImages(publicIds) {
  for (const publicId of publicIds) {
    await deleteImage(publicId);
  }
}

function parseGalleryKeep(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item) => item?.url && item?.publicId);
  } catch {
    return [];
  }
}

router.put(
  "/:id",
  requireAuth,
  upload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 4 },
  ]),
  async (req, res) => {
    try {
      const product = await Product.findById(req.params.id);
      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      const { title, description, price } = req.body;

      if (!title?.trim() || !description?.trim() || !price?.trim()) {
        return res
          .status(400)
          .json({ message: "Title, description, and price are required" });
      }

      const keptGallery = parseGalleryKeep(req.body.keptGallery);
      const galleryFiles = req.files?.galleryImages || [];
      const newGallery = [];

      for (const file of galleryFiles) {
        const uploaded = await uploadImageBuffer(file.buffer, file.mimetype);
        newGallery.push(uploaded);
      }

      const nextGallery = [...keptGallery, ...newGallery].slice(0, 4);

      const removedGalleryIds = product.galleryImages
        .map((img) => img.publicId)
        .filter((id) => !keptGallery.some((k) => k.publicId === id));

      let nextMainImage = product.mainImage;
      const mainFile = req.files?.mainImage?.[0];

      if (mainFile) {
        const uploaded = await uploadImageBuffer(mainFile.buffer, mainFile.mimetype);
        if (product.mainImage?.publicId) {
          await destroyImages([product.mainImage.publicId]);
        }
        nextMainImage = uploaded;
      }

      await destroyImages(removedGalleryIds);

      product.title = title.trim();
      product.description = description.trim();
      product.price = formatPrice(price);
      product.mainImage = nextMainImage;
      product.galleryImages = nextGallery;
      product.specifications = parseSpecifications(req.body.specifications);

      await product.save();

      res.json({ message: "Product updated", product });
    } catch (error) {
      console.error("Update product error:", error);
      res.status(500).json({
        message: error.message || "Failed to update product",
      });
    }
  }
);

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const publicIds = [
      product.mainImage?.publicId,
      ...product.galleryImages.map((img) => img.publicId),
    ].filter(Boolean);

    await destroyImages(publicIds);

    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;
