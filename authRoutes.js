const express = require("express");
const bcrypt = require("bcryptjs");
const { User, NGO } = require("./models");
const { signToken, authMiddleware } = require("./authUtils");

const router = express.Router();

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    xp: user.xp,
    level: user.level,
    badges: user.badges,
    totalDonated: user.totalDonated,
    donationCount: user.donationCount,
  };
}

router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashed });

    res.status(201).json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    res.json({
      token: signToken(user),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ngo/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      regNumber,
      taxStatus,
      areaOfWork,
      description,
      location,
      volunteerCount,
    } = req.body;

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

    res.status(201).json({
      message: "NGO application submitted. Verification takes 7 days.",
      ngo: { id: ngo._id, name: ngo.name, email: ngo.email, verified: ngo.verified },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ngo/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ngo = await NGO.findOne({ email });
    if (!ngo) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, ngo.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    if (!ngo.verified) {
      return res.status(403).json({ error: "NGO not yet verified by platform" });
    }

    res.json({
      token: signToken({ _id: ngo._id, role: "ngo", email: ngo.email }),
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
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authMiddleware };
