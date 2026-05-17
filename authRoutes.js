const express = require("express");
const bcrypt = require("bcryptjs");
const { User, NGO } = require("./models");
const { ADMIN_EMAIL, authMiddleware, signToken } = require("./authUtils");

const router = express.Router();

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    xp: user.xp,
    level: user.level,
    title: user.title,
    badges: user.badges,
    totalDonated: user.totalDonated,
    donationCount: user.donationCount,
  };
}

router.post("/register", async (req, res) => {
  try {
    const { name, password } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    if (email === ADMIN_EMAIL) {
      return res.status(403).json({ error: "This email is reserved for the platform admin" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed, role: "user" });

    return res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("[auth] Register failed:", err.message);
    return res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password || "", user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (user.role === "admin" && user.email !== ADMIN_EMAIL) {
      return res.status(403).json({ error: "Admin account is not authorized" });
    }

    return res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("[auth] Login failed:", err.message);
    return res.status(500).json({ error: "Login failed" });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.json(user);
  } catch (err) {
    console.error("[auth] Current user lookup failed:", err.message);
    return res.status(500).json({ error: "Unable to load user" });
  }
});

router.post("/ngo/register", async (req, res) => {
  try {
    const {
      name,
      password,
      regNumber,
      taxStatus,
      areaOfWork,
      description,
      location,
      volunteerCount,
    } = req.body;
    const email = normalizeEmail(req.body.email);

    if (!name || !email || !password || !regNumber || !taxStatus || !areaOfWork) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    const exists = await NGO.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const ngo = await NGO.create({
      name,
      email,
      password: hashed,
      regNumber,
      taxStatus,
      areaOfWork,
      description,
      location,
      volunteerCount: Number(volunteerCount) || 0,
    });

    return res.status(201).json({
      message: "NGO application submitted. Verification takes 7 days.",
      ngo: { id: ngo._id, name: ngo.name, email: ngo.email, verified: ngo.verified },
    });
  } catch (err) {
    console.error("[auth] NGO registration failed:", err.message);
    return res.status(500).json({ error: "NGO registration failed" });
  }
});

router.post("/ngo/login", async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const ngo = await NGO.findOne({ email });
    if (!ngo) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password || "", ngo.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (!ngo.verified) {
      return res.status(403).json({ error: "NGO not yet verified by platform" });
    }

    return res.json({
      token: signToken({ _id: ngo._id, email: ngo.email, role: "ngo" }),
      ngo: {
        id: ngo._id,
        name: ngo.name,
        email: ngo.email,
        verified: ngo.verified,
        tasksCompleted: ngo.tasksCompleted,
        rating: ngo.rating,
        impactScore: ngo.impactScore,
      },
    });
  } catch (err) {
    console.error("[auth] NGO login failed:", err.message);
    return res.status(500).json({ error: "NGO login failed" });
  }
});

module.exports = { router, authMiddleware };
