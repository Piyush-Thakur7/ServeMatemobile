require("dotenv").config();
const express   = require("express");
const mongoose  = require("mongoose");
const cors      = require("cors");
const path      = require("path");

const { router: authRouter } = require("./authRoutes");
const apiRouter              = require("./apiRoutes");
const adminRouter            = require("./adminRoutes");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://resence.in",
    "https://www.resence.in",
    "https://serve-matemobile.vercel.app",
    "http://localhost:3000",
    "http://localhost:5500"
  ],
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── DATABASE ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser:    true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log("✅ MongoDB connected");
  await seedDatabase();        // seed causes + admin on first run
})
.catch(err => console.error("❌ MongoDB error:", err));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.use("/api/auth",  authRouter);
app.use("/api",       apiRouter);
app.use("/api/admin", adminRouter);

// Health check
app.get("/api/health", (req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

// Serve frontend (if HTML is in root)
app.use(express.static(path.join(__dirname)));
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// ─── SEED DATA ────────────────────────────────────────────────────────────────
async function seedDatabase() {
  const { Cause, User } = require("./models");
  const bcrypt = require("bcryptjs");

  // Seed causes if none exist
  const causeCount = await Cause.countDocuments();
  if (causeCount === 0) {
    await Cause.insertMany([
      {
        title:         "Meals for All",
        description:   "Provide nutritious meals to underprivileged children and elderly. Every ₹10 feeds one person.",
        icon:          "🍱",
        category:      "meals",
        goal:          100000,
        raised:        73240,
        contributors:  2341,
        impactPerRupee:"₹10 feeds 1 person for a day"
      },
      {
        title:         "Tree Plantation Drive",
        description:   "Plant trees across urban wastelands and barren hillsides. ₹50 plants and nurtures one tree for a full year.",
        icon:          "🌱",
        category:      "trees",
        goal:          100000,
        raised:        58000,
        contributors:  1087,
        impactPerRupee:"₹50 = 1 tree planted & maintained"
      },
      {
        title:         "Daily Essentials Kit",
        description:   "Distribute hygiene kits and essential supplies to families in flood-affected zones.",
        icon:          "🧴",
        category:      "essentials",
        goal:          100000,
        raised:        41500,
        contributors:  892,
        impactPerRupee:"₹100 = 1 complete hygiene kit"
      }
    ]);
    console.log("🌱 Causes seeded");
  }

  // Create admin user if not exists
  const adminExists = await User.findOne({ role: "admin" });
  if (!adminExists) {
    const hashed = await bcrypt.hash(process.env.ADMIN_PASSWORD || "Admin@123", 10);
    await User.create({
      name:     "Admin",
      email:    process.env.ADMIN_EMAIL || "admin@servemate.in",
      password: hashed,
      role:     "admin"
    });
    console.log("👑 Admin user created — email:", process.env.ADMIN_EMAIL || "admin@servemate.in");
  }
}

// ─── START ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 ServeMate backend running on port ${PORT}`));
