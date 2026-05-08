require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const { ADMIN_EMAIL } = require("./authUtils");
const { router: authRouter } = require("./authRoutes");
const apiRouter = require("./apiRoutes");
const adminRouter = require("./adminRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

const defaultCorsOrigins = [
  "https://www.resence.in",
  "https://resence.in",
  "https://serve-matemobile.vercel.app",
];

const allowedOrigins = (process.env.CORS_ORIGINS || defaultCorsOrigins.join(","))
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    mongo: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    time: new Date().toISOString(),
  });
});

app.use("/api", (req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    return next();
  }

  return res.status(503).json({
    error: "Database unavailable",
    message: "The backend is running, but MongoDB is not connected.",
  });
});

app.use("/api/auth", authRouter);
app.use("/api", apiRouter);
app.use("/api/admin", adminRouter);

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  if (req.method !== "GET") {
    return next();
  }
  return res.sendFile(path.join(__dirname, "index.html"));
});

app.use((err, req, res, next) => {
  console.error("[server] Unhandled request error:", err.message);
  if (res.headersSent) {
    return next(err);
  }
  return res.status(500).json({ error: "Internal server error" });
});

async function connectMongo() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoUri) {
    console.warn("[mongo] MONGO_URI or MONGODB_URI is not set. Server started without database connectivity.");
    return;
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
      maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 10,
    });
    console.log("[mongo] Connected to MongoDB");
    await seedDatabase();
  } catch (err) {
    console.error("[mongo] Initial connection failed:", err.message);
  }
}

mongoose.connection.on("disconnected", () => {
  console.warn("[mongo] MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("[mongo] MongoDB reconnected");
});

async function seedDatabase() {
  const { Cause, User } = require("./models");
  const bcrypt = require("bcryptjs");

  const causeCount = await Cause.countDocuments();
  if (causeCount === 0) {
    await Cause.insertMany([
      {
        title: "Meals for All",
        description: "Provide nutritious meals to underprivileged children and elderly. Every INR 10 feeds one person.",
        icon: "meals",
        category: "meals",
        goal: 100000,
        raised: 73240,
        contributors: 2341,
        impactPerRupee: "INR 10 feeds 1 person for a day",
      },
      {
        title: "Tree Plantation Drive",
        description: "Plant trees across urban wastelands and barren hillsides. INR 50 plants and nurtures one tree for a full year.",
        icon: "trees",
        category: "trees",
        goal: 100000,
        raised: 58000,
        contributors: 1087,
        impactPerRupee: "INR 50 = 1 tree planted and maintained",
      },
      {
        title: "Daily Essentials Kit",
        description: "Distribute hygiene kits and essential supplies to families in flood-affected zones.",
        icon: "essentials",
        category: "essentials",
        goal: 100000,
        raised: 41500,
        contributors: 892,
        impactPerRupee: "INR 100 = 1 complete hygiene kit",
      },
    ]);
    console.log("[seed] Causes seeded");
  }

  const adminExists = await User.findOne({ email: ADMIN_EMAIL });
  if (!adminExists) {
    if (!process.env.ADMIN_PASSWORD) {
      console.warn(`[seed] ADMIN_PASSWORD is not set. Admin user ${ADMIN_EMAIL} was not auto-created.`);
      return;
    }

    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
    await User.create({
      name: "Admin",
      email: ADMIN_EMAIL,
      password: hashed,
      role: "admin",
    });
    console.log(`[seed] Admin user created: ${ADMIN_EMAIL}`);
  } else if (adminExists.role !== "admin") {
    console.warn(`[seed] ${ADMIN_EMAIL} exists but is not an admin. Update this user role manually before using admin APIs.`);
  }
}

app.listen(PORT, () => {
  console.log(`[server] ServeMate backend listening on port ${PORT}`);
  console.log(`[server] CORS origins: ${allowedOrigins.join(", ")}`);
});

connectMongo();
