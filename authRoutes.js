const express  = require("express");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const { User, NGO } = require("./models");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "servemate_secret";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const signToken = (id, role) =>
  jwt.sign({ id, role }, JWT_SECRET, { expiresIn: "7d" });

const authMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "No token provided" });
  try {
    const decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── USER REGISTER ───────────────────────────────────────────────────────────
// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: "All fields required" });

    const exists = await User.findOne({ email });
    if (exists)
      return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const user   = await User.create({ name, email, password: hashed });

    const token = signToken(user._id, "user");
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email,
              xp: user.xp, level: user.level, badges: user.badges,
              totalDonated: user.totalDonated, donationCount: user.donationCount }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── USER LOGIN ──────────────────────────────────────────────────────────────
// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ error: "Invalid credentials" });

    const token = signToken(user._id, "user");
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email,
              xp: user.xp, level: user.level, badges: user.badges,
              totalDonated: user.totalDonated, donationCount: user.donationCount }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET CURRENT USER ────────────────────────────────────────────────────────
// GET /api/auth/me
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NGO REGISTER ────────────────────────────────────────────────────────────
// POST /api/auth/ngo/register
router.post("/ngo/register", async (req, res) => {
  try {
    const { name, email, password, regNumber, taxStatus, areaOfWork,
            description, location, volunteerCount } = req.body;

    if (!name || !email || !password || !regNumber || !taxStatus || !areaOfWork)
      return res.status(400).json({ error: "All required fields must be filled" });

    const exists = await NGO.findOne({ email });
    if (exists)
      return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const ngo = await NGO.create({
      name, email, password: hashed, regNumber, taxStatus,
      areaOfWork, description, location,
      volunteerCount: Number(volunteerCount) || 0
    });

    res.status(201).json({
      message: "NGO application submitted. Verification takes 7 days.",
      ngo: { id: ngo._id, name: ngo.name, email: ngo.email, verified: ngo.verified }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── NGO LOGIN ───────────────────────────────────────────────────────────────
// POST /api/auth/ngo/login
router.post("/ngo/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ngo = await NGO.findOne({ email });
    if (!ngo) return res.status(400).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password, ngo.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    if (!ngo.verified)
      return res.status(403).json({ error: "NGO not yet verified by platform" });

    const token = signToken(ngo._id, "ngo");
    res.json({
      token,
      ngo: { id: ngo._id, name: ngo.name, email: ngo.email,
             verified: ngo.verified, tasksCompleted: ngo.tasksCompleted,
             rating: ngo.rating, impactScore: ngo.impactScore }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authMiddleware };
