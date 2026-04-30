#!/usr/bin/env node
/**
 * Product Import Utility
 * 
 * Usage:
 *   node scripts/import-products.js <path_to_csv>
 * 
 * Example:
 *   node scripts/import-products.js ./products.csv
 * 
 * Expected CSV columns:
 *   product_id, title, category, price, price_display, in_stock, 
 *   shopify_product_id, shopify_url, image_url, diamond_shape, 
 *   metal, style, description_short, tags, target_gender, notes_internal
 */

const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse");
const pg = require("pg");
require("dotenv").config();

const dbClient = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function importProducts(csvPath) {
  try {
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ File not found: ${csvPath}`);
      process.exit(1);
    }

    console.log(`📂 Reading CSV from: ${csvPath}`);

    await dbClient.connect();
    console.log("🔗 Connected to database");

    const products = [];
    const fileStream = fs.createReadStream(csvPath);

    const parser = fileStream.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    );

    for await (const record of parser) {
      products.push({
        product_id: record.product_id?.trim(),
        title: record.title?.trim(),
        category: record.category?.trim() || null,
        price: parseFloat(record.price) || null,
        price_display: record.price_display?.trim() || null,
        in_stock: record.in_stock?.toLowerCase() === "true" || record.in_stock === "1",
        shopify_product_id: record.shopify_product_id?.trim() || null,
        shopify_url: record.shopify_url?.trim() || null,
        image_url: record.image_url?.trim() || null,
        diamond_shape: record.diamond_shape?.trim() || null,
        metal: record.metal?.trim() || null,
        style: record.style?.trim() || null,
        description_short: record.description_short?.trim() || null,
        tags: record.tags?.split(",").map((t) => t.trim()).filter(Boolean) || [],
        target_gender: record.target_gender?.trim() || null,
        notes_internal: record.notes_internal?.trim() || null,
      });
    }

    console.log(`📦 Loaded ${products.length} products from CSV`);

    if (products.length === 0) {
      console.error("❌ No products found in CSV");
      process.exit(1);
    }

    // Insert products
    let inserted = 0;
    let skipped = 0;

    for (const product of products) {
      try {
        const { product_id, ...rest } = product;

        const query = `
          INSERT INTO products (product_id, title, category, price, price_display, in_stock, 
            shopify_product_id, shopify_url, image_url, diamond_shape, metal, style, 
            description_short, tags, target_gender, notes_internal, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW())
          ON CONFLICT (product_id) DO UPDATE SET
            title = EXCLUDED.title,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            price_display = EXCLUDED.price_display,
            in_stock = EXCLUDED.in_stock,
            shopify_product_id = EXCLUDED.shopify_product_id,
            shopify_url = EXCLUDED.shopify_url,
            image_url = EXCLUDED.image_url,
            diamond_shape = EXCLUDED.diamond_shape,
            metal = EXCLUDED.metal,
            style = EXCLUDED.style,
            description_short = EXCLUDED.description_short,
            tags = EXCLUDED.tags,
            target_gender = EXCLUDED.target_gender,
            notes_internal = EXCLUDED.notes_internal,
            updated_at = NOW()
        `;

        await dbClient.query(query, [
          product_id,
          rest.title,
          rest.category,
          rest.price,
          rest.price_display,
          rest.in_stock,
          rest.shopify_product_id,
          rest.shopify_url,
          rest.image_url,
          rest.diamond_shape,
          rest.metal,
          rest.style,
          rest.description_short,
          rest.tags,
          rest.target_gender,
          rest.notes_internal,
        ]);

        inserted++;
        if (inserted % 10 === 0) {
          process.stdout.write(`\r✅ Inserted/updated: ${inserted}/${products.length}`);
        }
      } catch (error) {
        console.error(`\n❌ Error inserting product ${product.product_id}:`, error.message);
        skipped++;
      }
    }

    console.log(`\n\n✨ Import complete!`);
    console.log(`   ✅ Inserted/Updated: ${inserted}`);
    if (skipped > 0) {
      console.log(`   ⚠️  Skipped: ${skipped}`);
    }
    console.log(`   📊 Total in CSV: ${products.length}`);

    // Show some stats
    const result = await dbClient.query(`
      SELECT COUNT(*) as total, 
             SUM(CASE WHEN in_stock THEN 1 ELSE 0 END) as in_stock,
             COUNT(DISTINCT diamond_shape) as shapes,
             COUNT(DISTINCT metal) as metals
      FROM products
    `);

    const stats = result.rows[0];
    console.log(`\n📈 Database Stats:`);
    console.log(`   Total products: ${stats.total}`);
    console.log(`   In stock: ${stats.in_stock}`);
    console.log(`   Unique shapes: ${stats.shapes}`);
    console.log(`   Unique metals: ${stats.metals}`);

    await dbClient.end();
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/import-products.js <path_to_csv>");
  console.error("\nExample: node scripts/import-products.js ./products.csv");
  process.exit(1);
}

importProducts(csvPath);
