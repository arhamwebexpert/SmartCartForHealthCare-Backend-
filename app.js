const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const path = require("path");
const crypto = require("crypto");
const clients = new Set();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.static(path.join(__dirname, "public")));
app.use((req, res, next) => {
  /* logging… */ next();
});

// ─── SSE ENDPOINT ───
app.get("/api/scan-stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// Database setup
let db;

// Debug middleware for logging requests
app.use((req, res, next) => {
  console.log(
    `[${new Date().toISOString()}] ${req.method} ${req.path}`,
    req.body
  );
  next();
});

// Fix the database initialization in app.js
async function initializeDatabase() {
  console.log("Opening database connection...");
  db = await open({
    filename: path.join(__dirname, "database.sqlite"),
    driver: sqlite3.Database,
  });

  console.log("Creating tables if they don't exist...");

  // Enable foreign keys
  await db.exec("PRAGMA foreign_keys = ON;");
  console.log("Foreign keys enabled");

  // Update the scanned_items table schema to include all required columns
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scanned_items (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      folder_id TEXT,
      name TEXT,
      brand TEXT,
      calories INTEGER,
      protein TEXT,
      carbs TEXT,
      fats TEXT,
      quantity TEXT,
      image TEXT,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(folder_id) REFERENCES folders(id)
    )
  `);
  console.log("scanned_items table created/verified");

  await db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("folders table created/verified");

  // Create products table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      barcode TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL,
      calories INTEGER,
      protein TEXT,
      carbs TEXT,
      fats TEXT,
      quantity TEXT,
      image TEXT
    )
  `);
  console.log("products table created/verified");

  // Insert sample data if database is empty
  const count = await db.get("SELECT COUNT(*) as count FROM products");
  if (count.count === 0) {
    console.log("Inserting sample products...");
    await db.run(
      `INSERT INTO products (barcode, name, brand, calories, protein, carbs, fats, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "8901234567890",
        "Organic Greek Yogurt",
        "Nature Valley",
        120,
        "15g",
        "9g",
        "2g",
        "170g",
        "/api/placeholder/80/80",
      ]
    );

    await db.run(
      `INSERT INTO products (barcode, name, brand, calories, protein, carbs, fats, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "7654321098765",
        "Crunchy Peanut Butter",
        "Nutty Delights",
        190,
        "7g",
        "6g",
        "16g",
        "340g",
        "/api/placeholder/80/80",
      ]
    );

    console.log("Sample products inserted into database");
  }

  // Debug: Let's see what's in each table
  console.log("Current database state:");
  const products = await db.all("SELECT * FROM products");
  console.log("Products:", products);

  const folders = await db.all("SELECT * FROM folders");
  console.log("Folders:", folders);

  const items = await db.all("SELECT * FROM scanned_items");
  console.log("Scanned Items:", items);

  console.log("Database initialized successfully");
}

// Initialize DB before starting server
initializeDatabase()
  .then(() => {
    // Product routes
    app.get("/api/products", async (req, res) => {
      try {
        const products = await db.all("SELECT * FROM products");
        res.json(products);
      } catch (error) {
        console.error("Error fetching products:", error);
        res.status(500).json({ error: "Failed to retrieve products" });
      }
    });

    app.get("/api/products/:barcode", async (req, res) => {
      try {
        const product = await db.get(
          "SELECT * FROM products WHERE barcode = ?",
          req.params.barcode
        );
        if (product) {
          res.json(product);
        } else {
          res.status(404).json({ error: "Product not found" });
        }
      } catch (error) {
        console.error("Error fetching product:", error);
        res.status(500).json({ error: "Failed to retrieve product" });
      }
    });

    app.post("/api/products", async (req, res) => {
      try {
        const {
          barcode,
          name,
          brand,
          calories,
          protein,
          carbs,
          fats,
          quantity,
          image,
        } = req.body;

        if (!barcode || !name || !brand) {
          return res
            .status(400)
            .json({ error: "Barcode, name, and brand are required" });
        }

        await db.run(
          "INSERT INTO products (barcode, name, brand, calories, protein, carbs, fats, quantity, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            barcode,
            name,
            brand,
            calories,
            protein,
            carbs,
            fats,
            quantity,
            image || "/api/placeholder/80/80",
          ]
        );

        const newProduct = await db.get(
          "SELECT * FROM products WHERE barcode = ?",
          barcode
        );
        res.status(201).json(newProduct);
      } catch (error) {
        console.error("Error creating product:", error);
        res.status(500).json({ error: "Failed to create product" });
      }
    });

    app.put("/api/products/:barcode", async (req, res) => {
      try {
        const { name, brand, calories, protein, carbs, fats, quantity, image } =
          req.body;
        const { barcode } = req.params;

        await db.run(
          `UPDATE products SET 
           name = ?, brand = ?, calories = ?, protein = ?, 
           carbs = ?, fats = ?, quantity = ?, image = ?
           WHERE barcode = ?`,
          [
            name,
            brand,
            calories,
            protein,
            carbs,
            fats,
            quantity,
            image,
            barcode,
          ]
        );

        const updatedProduct = await db.get(
          "SELECT * FROM products WHERE barcode = ?",
          barcode
        );
        if (updatedProduct) {
          res.json(updatedProduct);
        } else {
          res.status(404).json({ error: "Product not found" });
        }
      } catch (error) {
        console.error("Error updating product:", error);
        res.status(500).json({ error: "Failed to update product" });
      }
    });

    app.delete("/api/products/:barcode", async (req, res) => {
      try {
        const result = await db.run(
          "DELETE FROM products WHERE barcode = ?",
          req.params.barcode
        );
        if (result.changes > 0) {
          res.status(204).send();
        } else {
          res.status(404).json({ error: "Product not found" });
        }
      } catch (error) {
        console.error("Error deleting product:", error);
        res.status(500).json({ error: "Failed to delete product" });
      }
    });

    // Folder routes
    app.get("/api/folders", async (req, res) => {
      try {
        const folders = await db.all(
          "SELECT * FROM folders ORDER BY created_at DESC"
        );
        console.log("GET /api/folders response:", folders);
        res.json(folders);
      } catch (error) {
        console.error("Error fetching folders:", error);
        res.status(500).json({ error: "Failed to retrieve folders" });
      }
    });

    app.post("/api/folders", async (req, res) => {
      try {
        const { name } = req.body;
        if (!name) {
          return res.status(400).json({ error: "Folder name is required" });
        }

        const id = crypto.randomUUID();
        console.log(`Creating new folder with id ${id} and name "${name}"`);

        await db.run("INSERT INTO folders (id, name) VALUES (?, ?)", [
          id,
          name,
        ]);
        console.log("Folder inserted into database");

        const newFolder = await db.get(
          "SELECT * FROM folders WHERE id = ?",
          id
        );
        console.log("New folder:", newFolder);

        res.status(201).json(newFolder);
      } catch (error) {
        console.error("Error creating folder:", error);
        res.status(500).json({ error: "Failed to create folder" });
      }
    });

    app.get("/api/folders/:id", async (req, res) => {
      try {
        const folder = await db.get(
          "SELECT * FROM folders WHERE id = ?",
          req.params.id
        );
        if (folder) {
          res.json(folder);
        } else {
          console.log(`Folder with id ${req.params.id} not found`);
          res.status(404).json({ error: "Folder not found" });
        }
      } catch (error) {
        console.error("Error fetching folder:", error);
        res.status(500).json({ error: "Failed to retrieve folder" });
      }
    });

    app.put("/api/folders/:id", async (req, res) => {
      try {
        const { name } = req.body;
        const { id } = req.params;

        if (!name) {
          return res.status(400).json({ error: "Folder name is required" });
        }

        await db.run(
          "UPDATE folders SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          [name, id]
        );

        const updatedFolder = await db.get(
          "SELECT * FROM folders WHERE id = ?",
          id
        );
        if (updatedFolder) {
          res.json(updatedFolder);
        } else {
          res.status(404).json({ error: "Folder not found" });
        }
      } catch (error) {
        console.error("Error updating folder:", error);
        res.status(500).json({ error: "Failed to update folder" });
      }
    });

    app.delete("/api/folders/:id", async (req, res) => {
      try {
        const { id } = req.params;

        await db.run("DELETE FROM folders WHERE id = ?", id);

        res.status(204).send();
      } catch (error) {
        console.error("Error deleting folder:", error);
        res.status(500).json({ error: "Failed to delete folder" });
      }
    });

    // Get items in a folder
    app.get("/api/folders/:id/items", async (req, res) => {
      try {
        const items = await db.all(
          `SELECT 
        id,
        barcode,
        folder_id AS folderId,
        name,
        brand,
        calories,
        protein,
        carbs,
        fats,
        quantity,
        image,
        scanned_at AS timestamp
       FROM scanned_items 
       WHERE folder_id = ?
       ORDER BY scanned_at DESC`,
          req.params.id
        );
        res.json(items);
      } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Failed to fetch items" });
      }
    });
    // Create (scan) a new item in a folder
    app.post("/api/folders/:id/items", async (req, res) => {
      try {
        const folderId = req.params.id;
        const { id, barcode } = req.body;
        const stringId = String(id);
        console.log(
          `Saving scanned item with id ${stringId}, barcode ${barcode} to folder ${folderId}`
        );

        if (!stringId || !barcode) {
          console.error("Missing required fields:", { id, barcode });
          return res.status(400).json({ error: "ID and barcode are required" });
        }

        // Verify folder exists
        const folder = await db.get(
          "SELECT * FROM folders WHERE id = ?",
          folderId
        );
        if (!folder) {
          console.error(`Folder with id ${folderId} not found`);
          return res.status(404).json({ error: "Folder not found" });
        }
        console.log("Folder found:", folder);

        // Get product information
        const product = await db.get(
          `SELECT * FROM products WHERE barcode = ?`,
          [barcode]
        );
        console.log("Product found:", product);

        console.log("Inserting into scanned_items table with values:", {
          stringId,
          barcode,
          folderId,
          name: product?.name || "Unknown Product",
          brand: product?.brand || "Unknown",
          calories: product?.calories || 0,
          protein: product?.protein || "0g",
          carbs: product?.carbs || "0g",
          fats: product?.fats || "0g",
          quantity: product?.quantity || "Unknown",
          image: product?.image || "/api/placeholder/80/80",
        });

        // Insert into scanned_items with product information
        const result = await db.run(
          `INSERT INTO scanned_items 
           (id, barcode, folder_id, name, brand, calories, protein, carbs, fats, quantity, image)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            barcode,
            folderId,
            product?.name || "Unknown Product",
            product?.brand || "Unknown",
            product?.calories || 0,
            product?.protein || "0g",
            product?.carbs || "0g",
            product?.fats || "0g",
            product?.quantity || "Unknown",
            product?.image || "/api/placeholder/80/80",
          ]
        );
        console.log("Insert result:", result);

        // Return the newly-inserted row with all product information
        const newItem = await db.get(
          `SELECT 
             id,
             barcode,
             folder_id AS folderId,
             name,
             brand,
             calories,
             protein,
             carbs,
             fats,
             quantity,
             image,
             scanned_at AS timestamp
           FROM scanned_items
           WHERE id = ?`,
          [id]
        );
        console.log("New item inserted:", newItem);

        // Verify total items in the folder after insertion
        const allItems = await db.all(
          "SELECT * FROM scanned_items WHERE folder_id = ?",
          folderId
        );
        console.log(
          `Total items in folder after insertion: ${allItems.length}`
        );

        res.status(201).json(newItem);
      } catch (error) {
        console.error("Error creating scanned item:", error);
        console.error("Stack trace:", error.stack);
        res.status(500).json({ error: "Failed to save scanned item" });
      }
    });

    // Debug endpoint to check database status
    app.get("/api/debug/status", async (req, res) => {
      try {
        const tables = await db.all(
          "SELECT name FROM sqlite_master WHERE type='table'"
        );

        const dbStatus = {
          tables: tables.map((t) => t.name),
          counts: {},
        };

        for (const table of tables) {
          if (table.name.startsWith("sqlite_")) continue;
          const count = await db.get(
            `SELECT COUNT(*) as count FROM ${table.name}`
          );
          dbStatus.counts[table.name] = count.count;
        }

        res.json(dbStatus);
      } catch (error) {
        console.error("Error fetching debug status:", error);
        res.status(500).json({ error: "Failed to get debug status" });
      }
    });

    // Replace your current non-DB /api/scan with this:
    let lastScannedBarcode = null;

    app.post("/api/scan", async (req, res) => {
      const { barcode } = req.body;

      if (!barcode) {
        return res.status(400).json({ error: "Barcode is required" });
      }

      try {
        const product = await db.get(
          "SELECT * FROM products WHERE barcode = ?",
          [barcode]
        );

        if (!product) {
          return res.status(404).json({
            error: "Product not found",
            barcode,
          });
        }

        // ✅ Save barcode to global variable
        lastScannedBarcode = barcode;
        for (const clientRes of clients) {
          clientRes.write(`data: ${JSON.stringify({ barcode })}\n\n`);
        }
        res.json({
          message: "Barcode valid",
          product,
        });

        await db.run(
          `INSERT INTO scanned_items
       (id, barcode, folder_id, name, brand, calories, protein, carbs, fats, quantity, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            crypto.randomUUID(),
            barcode,
            null,
            product.name,
            product.brand,
            product.calories,
            product.protein,
            product.carbs,
            product.fats,
            product.quantity,
            product.image,
          ]
        );
      } catch (err) {
        console.error("Error in /api/scan:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    app.get("/api/sendscannedbarcode", (req, res) => {
      if (!lastScannedBarcode) {
        return res.status(404).json({ error: "No scanned barcode found" });
      }

      res.status(200).json({ barcode: lastScannedBarcode });
      lastScannedBarcode = null;
    });

    // In your app.js, right alongside your other routes:

    /**
     * GET /api/scan/:barcode
     *
     * Lookup a product by barcode and return its info as JSON.
     * Frontend can then take that JSON and call addScannedItem(...) to
     * persist it into the active folder.
     */
    app.get("/api/scan/:barcode", async (req, res) => {
      const { barcode } = req.params;

      if (!barcode) {
        return res.status(400).json({ error: "Barcode is required" });
      }

      try {
        // 1. Fetch product details
        const product = await db.get(
          "SELECT * FROM products WHERE barcode = ?",
          barcode
        );

        if (!product) {
          return res.status(404).json({ error: "Product not found" });
        }

        // 2. Send back exactly what the client needs
        res.json({
          message: "Barcode valid",
          product: {
            barcode: product.barcode,
            name: product.name,
            brand: product.brand,
            calories: product.calories,
            protein: product.protein,
            carbs: product.carbs,
            fats: product.fats,
            quantity: product.quantity,
            image: product.image,
          },
        });
      } catch (err) {
        console.error("Error in GET /api/scan/:barcode:", err);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    // Start server
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on 0.0.0.0:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
