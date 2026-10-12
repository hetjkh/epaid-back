require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");
const Product = require("../models/Product");
const catalog = require("../data/products.json");

/**
 * Replaces every product in the database with data/products.json.
 * Image URLs point at the frontend's /public/epaid-prodcuts folder.
 */
async function seed() {
  await connectDB();

  const { deletedCount } = await Product.deleteMany({});
  console.log(`Removed ${deletedCount} existing product(s)`);

  const now = Date.now();
  const docs = catalog.map((product, index) => ({
    ...product,
    createdAt: new Date(now - index * 1000),
    updatedAt: new Date(now - index * 1000),
  }));

  const created = await Product.insertMany(docs);
  console.log(`Inserted ${created.length} product(s):`);
  for (const p of created) {
    console.log(`  ${p._id}  ${p.title}`);
  }
}

seed()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
