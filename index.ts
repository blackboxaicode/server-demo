import express from "express";
import dotenv from "dotenv";
import sqlite3 from "sqlite3";
import { logger } from "./logger.js";

// Load environment variables
dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// SQLite database setup
let db: sqlite3.Database | null = null;

// Initialize database
function initDatabase() {
  return new Promise<void>((resolve, reject) => {
    db = new sqlite3.Database('./demo.db', (err) => {
      if (err) {
        logger.error({ error: err.message }, 'Failed to connect to database');
        reject(err);
      } else {
        logger.info('Connected to SQLite database');

        // Create users table
        db!.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
          if (err) {
            logger.error({ error: err.message }, 'Failed to create users table');
            reject(err);
          } else {
            logger.info('Users table ready');
            resolve();
          }
        });
      }
    });
  });
}

// Actually disconnect the database
function disconnectDatabase() {
  return new Promise<void>((resolve) => {
    if (db) {
      db.close((err) => {
        if (err) {
          logger.error({ error: err.message }, 'Error closing database');
        } else {
          logger.error('Database connection lost');
        }
        db = null;
        resolve();
      });
    } else {
      console.error("Database connection failure");
      resolve();
    }
  });
}

// Simulate real database connection failures
async function simulateRealDbFailure() {
  if (db) {
    // Actually disconnect
    await disconnectDatabase();

    // Simulate recovery after 3-5 seconds
    const recoveryTime = 3000 + Math.random() * 2000;
    setTimeout(async () => {
      try {
        await initDatabase();
        // logger.info("Database connection recovered");
      } catch (err) {
        logger.error({ error: err }, "Failed to recover database connection");
      }
    }, recoveryTime);
  }
}

// Route racine
app.get("/", (req, res) => {
  res.json({ message: "hello world" });
});

// Route /health
app.get("/health", (req, res) => {
  const status = {
    uptime: process.uptime(),
    timestamp: new Date(),
    memoryUsage: process.memoryUsage(),
    database: {
      connected: db !== null,
      status: db ? "healthy" : "connection lost"
    }
  };

  logger.info({ status }, "Health check");
  res.json({ status: "ok", serverStatus: status });
});

// Route to get all users (will fail when db is actually down)
app.get("/users", (req, res) => {
  if (!db) {
    logger.error("Attempted to query users but database is not connected");
    return res.status(503).json({
      error: "Database connection not available",
      message: "Service temporarily unavailable"
    });
  }

  db.all("SELECT * FROM users ORDER BY created_at DESC", (err, rows) => {
    if (err) {
      logger.error({ error: err.message }, "Failed to query users");
      return res.status(500).json({ error: "Database query failed" });
    }

    logger.info({ count: rows.length }, "Retrieved users from database");
    res.json({ users: rows });
  });
});

// Route to create a user (will fail when db is actually down)
app.post("/users", (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required" });
  }

  if (!db) {
    logger.error("Attempted to create user but database is not connected");
    return res.status(503).json({
      error: "Database connection not available",
      message: "Service temporarily unavailable"
    });
  }

  db.run("INSERT INTO users (name, email) VALUES (?, ?)", [name, email], function (err) {
    if (err) {
      logger.error({ error: err.message, name, email }, "Failed to create user");
      return res.status(500).json({ error: "Failed to create user" });
    }

    logger.info({ userId: this.lastID, name, email }, "Created new user");
    res.status(201).json({
      id: this.lastID,
      name,
      email,
      message: "User created successfully"
    });
  });
});

const intervalMs = 5000; // 5 seconds
let failureIntervalId = -1;

app.get("/failureOn", (req, res) => {
  // Actually disconnect and reconnect database every 10-15 seconds
  if (failureIntervalId == -1) {
    failureIntervalId = Number(setInterval(() => {
      simulateRealDbFailure();
    }, intervalMs * 2));
    return res.json({ message: "db failure activated" });
  } else
    return res.json({ message: "db failure already active" });
});

app.get("/failureOff", async (req, res) => {
  // Actually disconnect and reconnect database every 10-15 seconds
  if (failureIntervalId != -1) {
    clearInterval(failureIntervalId);
    failureIntervalId = -1;
    await initDatabase();
  }
  return res.json({ message: "db failure deactivated" });
});

// Initialize database on startup
initDatabase().catch(err => {
  logger.error({ error: err }, "Failed to initialize database");
});

// Lancer le serveur
app.listen(PORT, () => {
   failureIntervalId = Number(setInterval(() => {
      simulateRealDbFailure();
    }, intervalMs * 2));
  logger.info(`Server started on http://localhost:${PORT}`);
  console.log(`Server running on http://localhost:${PORT}`);
});


setInterval(() => {
  const status = {
    uptime: process.uptime(),
    timestamp: new Date(),
    memoryUsage: process.memoryUsage(),
    database: db ? "connected" : "disconnected"
  };
  logger.info({ status }, "Periodic server status");
}, intervalMs);
