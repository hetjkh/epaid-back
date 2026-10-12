const express = require("express");
const mongoose = require("mongoose");
const Product = require("../models/Product");
const { requireAuth } = require("../middleware/auth");
const {
  uploadImageBuffer,
  deleteImage,
  imageUpload,
  handleUpload,
} = require("../utils/uploadImage");
const { formatPrice } = require("../utils/formatPrice");
const { sendError } = require("../utils/httpError");

const router = express.Router();

router.param("id", (req, res, next, id) => {
  if (!mongoose.isValidObjectId(id)) {
    return res.status(404).json({ message: "Product not found" });
  }
  next();
});

const productImages = handleUpload(
  imageUpload.fields([
    { name: "mainImage", maxCount: 1 },
    { name: "galleryImages", maxCount: 4 },
  ])
);

/** Multipart fields can arrive as arrays when repeated; only accept a single string. */
function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function parseJsonArray(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSpecifications(raw) {
  return parseJsonArray(raw)
    .map((item) => ({ label: text(item?.label), value: text(item?.value) }))
    .filter((item) => item.label && item.value)
    .slice(0, 50);
}

function readProductFields(body) {
  const fields = {
    title: text(body.title),
    description: text(body.description),
    price: text(body.price),
  };
  return fields.title && fields.description && fields.price ? fields : null;
}

async function destroyImages(publicIds) {
  for (const publicId of publicIds) {
    await deleteImage(publicId);
  }
}

router.get("/", async (_req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 }).lean();
    res.json({ products });
  } catch (error) {
    console.error("Fetch products error:", error);
    res.status(500).json({ message: "Failed to fetch products" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ product });
  } catch (error) {
    console.error("Fetch product error:", error);
    res.status(500).json({ message: "Failed to fetch product" });
  }
});

router.post("/", requireAuth, productImages, async (req, res) => {
  try {
    const fields = readProductFields(req.body);
    if (!fields) {
      return res.status(400).json({ message: "Title, description, and price are required" });
    }

    const mainFile = req.files?.mainImage?.[0];
    if (!mainFile) {
      return res.status(400).json({ message: "Main image is required" });
    }

    const mainImage = await uploadImageBuffer(mainFile.buffer, mainFile.mimetype);
    const galleryImages = [];
    for (const file of req.files?.galleryImages || []) {
      galleryImages.push(await uploadImageBuffer(file.buffer, file.mimetype));
    }

    const product = await Product.create({
      title: fields.title,
      description: fields.description,
      price: formatPrice(fields.price),
      mainImage,
      galleryImages,
      specifications: parseSpecifications(req.body.specifications),
    });

    res.status(201).json({ message: "Product created", product });
  } catch (error) {
    console.error("Create product error:", error);
    sendError(res, error, "Failed to create product");
  }
});

router.put("/:id", requireAuth, productImages, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const fields = readProductFields(req.body);
    if (!fields) {
      return res.status(400).json({ message: "Title, description, and price are required" });
    }

    // Only images that already belong to this product can be kept.
    const keepIds = new Set(parseJsonArray(req.body.keptGallery).map((item) => item?.publicId));
    const keptGallery = product.galleryImages.filter((img) => keepIds.has(img.publicId));
    const removedGalleryIds = product.galleryImages
      .filter((img) => !keepIds.has(img.publicId))
      .map((img) => img.publicId);

    const newGallery = [];
    for (const file of req.files?.galleryImages || []) {
      newGallery.push(await uploadImageBuffer(file.buffer, file.mimetype));
    }

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

    product.title = fields.title;
    product.description = fields.description;
    product.price = formatPrice(fields.price);
    product.mainImage = nextMainImage;
    product.galleryImages = [...keptGallery, ...newGallery].slice(0, 4);
    product.specifications = parseSpecifications(req.body.specifications);

    await product.save();

    res.json({ message: "Product updated", product });
  } catch (error) {
    console.error("Update product error:", error);
    sendError(res, error, "Failed to update product");
  }
});

router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    await destroyImages(
      [product.mainImage?.publicId, ...product.galleryImages.map((img) => img.publicId)].filter(
        Boolean
      )
    );

    await product.deleteOne();
    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Delete product error:", error);
    res.status(500).json({ message: "Failed to delete product" });
  }
});

module.exports = router;
