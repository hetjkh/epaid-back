const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
  },
  { _id: false }
);

const specificationSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const featureSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    price: { type: String, required: true, trim: true },
    mainImage: { type: imageSchema, required: true },
    galleryImages: {
      type: [imageSchema],
      validate: [(val) => val.length <= 4, "Maximum 4 gallery images allowed"],
      default: [],
    },
    specifications: { type: [specificationSchema], default: [] },
    highlights: { type: [String], default: [] },
    features: { type: [featureSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
