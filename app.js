// app.js - Main application file
const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const { open } = require("sqlite");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Database setup
let db;

async function initializeDatabase() {
  db = await open({
    filename: path.join(__dirname, "database.sqlite"),
    driver: sqlite3.Database,
  });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS scanned_items (
      id TEXT PRIMARY KEY,
      barcode TEXT NOT NULL,
      folder_id TEXT,
      scanned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(folder_id) REFERENCES folders(id)
    )
  `);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
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

  // Insert sample data if database is empty
  const count = await db.get("SELECT COUNT(*) as count FROM products");
  if (count.count === 0) {
    await db.run(
      `
      INSERT INTO products (barcode, name, brand, calories, protein, carbs, fats, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
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
      `
      INSERT INTO products (barcode, name, brand, calories, protein, carbs, fats, quantity, image)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
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

    // User authentication routes would go here
    // ...

    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
app.get("/api/folders", async (req, res) => {
  try {
    const folders = await db.all(
      "SELECT * FROM folders ORDER BY created_at DESC"
    );
    res.json(folders);
  } catch (error) {
    console.error("Error fetching folders:", error);
    res.status(500).json({ error: "Failed to retrieve folders" });
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
      res.status(404).json({ error: "Folder not found" });
    }
  } catch (error) {
    console.error("Error fetching folder:", error);
    res.status(500).json({ error: "Failed to retrieve folder" });
  }
});

app.post("/api/folders", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: "Folder name is required" });
    }

    const id = crypto.randomUUID();
    await db.run("INSERT INTO folders (id, name) VALUES (?, ?)", [id, name]);

    const newFolder = await db.get("SELECT * FROM folders WHERE id = ?", id);
    res.status(201).json(newFolder);
  } catch (error) {
    console.error("Error creating folder:", error);
    res.status(500).json({ error: "Failed to create folder" });
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
      `
        SELECT * FROM scanned_items 
        WHERE folder_id = ?
        ORDER BY scanned_at DESC
      `,
      req.params.id
    );

    res.json(items);
  } catch (error) {
    console.error("Error fetching folder items:", error);
    res.status(500).json({ error: "Failed to retrieve folder items" });
  }
});

// Create (scan) a new item in a folder
app.post("/api/folders/:id/items", async (req, res) => {
  try {
    const folderId = req.params.id;
    const { id, barcode } = req.body;

    // Insert into scanned_items; scanned_at will default to CURRENT_TIMESTAMP
    await db.run(
      `INSERT INTO scanned_items (id, barcode, folder_id)
       VALUES (?, ?, ?)`,
      [id, barcode, folderId]
    );

    // Return the newly‐inserted row
    const newItem = await db.get(
      `SELECT 
         id,
         barcode,
         folder_id AS folderId,
         scanned_at AS timestamp
       FROM scanned_items
       WHERE id = ?`,
      [id]
    );

    res.status(201).json(newItem);
  } catch (error) {
    console.error("Error creating scanned item:", error);
    res.status(500).json({ error: "Failed to save scanned item" });
  }
});
