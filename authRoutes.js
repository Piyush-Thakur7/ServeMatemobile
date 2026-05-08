const express = require("express");
const bcrypt = require("bcryptjs");
const { User, NGO, Activity, ADMIN_EMAIL, progressionForXp } = require("./models");
const { signToken, authMiddleware } = require("./authUtils");

const router = express.Router();

function publicUser(user) {
  const progression = progressionForXp(user.xp || 0);
  return {
    id: user._id,
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role,
    xp: user.xp,
    level: user.level,
    title: user.title,
    badges: user.badges || [],
    tokenBalance: user.tokenBalance || 0,
    totalTokensPurchased: user.totalTokensPurchased || 0,
    totalImpact: user.totalImpact || 0,
    profileImage: user.profileImage || user.avatar || "",
    bio: user.bio || "",
    achievements: user.achievements || [],
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    xpProgress: progression.xpProgress,
    nextLevelXp: progression.nextLevelXp,
    xpToNextLevel: progression.xpToNextLevel,
  };
}

function isNewLoginDay(lastDailyXpAt, now = new Date()) {
  if (!lastDailyXpAt) return true;
  return lastDailyXpAt.toISOString().slice(0, 10) !== now.toISOString().slice(0, 10);
}

async function recordLogin(user) {
  const now = new Date();
  user.lastLogin = now;
  user.addAchievement("first_login");

  if (isNewLoginDay(user.lastDailyXpAt, now)) {
    user.xp += 10;
    user.lastDailyXpAt = now;
    user.addAchievement("daily_login");
    user.recalculateGamification();
    await Activity.create({
      userId: user._id,
      type: "daily_login",
      message: "Daily login XP earned.",
      xp: 10,
    });
  }

  await user.save();
}

router.post("/register", async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "Name, email, and password are required" });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: "Email already registered" });

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      username,
      email: normalizedEmail,
      password: hashed,
      role: normalizedEmail === ADMIN_EMAIL ? "admin" : "user",
    });
    await recordLogin(user);

    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ error: "Email or username already exists" });
    res.status(500).json({ error: err.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password || "", user.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });

    if (user.email === ADMIN_EMAIL && user.role !== "admin") {
      user.role = "admin";
    }
    await recordLogin(user);

    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ngo/register", async (req, res) => {
  try {
    const {
      ngoName,
      name,
      description,
      founderName,
      email,
      phone,
      location,
      documents,
      regNumber,
      taxStatus,
      areaOfWork,
      volunteerCount,
      password,
    } = req.body;

    const finalNgoName = ngoName || name;
    if (!finalNgoName || !email || !founderName || !phone || !location) {
      return res.status(400).json({ error: "NGO name, founder, email, phone, and location are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const exists = await NGO.findOne({ email: normalizedEmail });
    if (exists) return res.status(400).json({ error: "NGO email already registered" });

    const hashed = password ? await bcrypt.hash(password, 12) : undefined;
    const ngo = await NGO.create({
      ngoName: finalNgoName,
      name: finalNgoName,
      description,
      founderName,
      email: normalizedEmail,
      phone,
      location,
      documents: Array.isArray(documents) ? documents : [],
      password: hashed,
      regNumber,
      taxStatus,
      areaOfWork,
      volunteerCount: Number(volunteerCount) || 0,
      approvalStatus: "pending",
      verified: false,
    });

    res.status(201).json({
      message: "NGO application submitted for admin review.",
      ngo: {
        id: ngo._id,
        ngoName: ngo.ngoName,
        email: ngo.email,
        verified: ngo.verified,
        approvalStatus: ngo.approvalStatus,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ngo/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const ngo = await NGO.findOne({ email: String(email || "").toLowerCase().trim() });
    if (!ngo || !ngo.password) return res.status(400).json({ error: "Invalid credentials" });

    const match = await bcrypt.compare(password || "", ngo.password);
    if (!match) return res.status(400).json({ error: "Invalid credentials" });
    if (!ngo.verified || ngo.approvalStatus !== "approved") {
      return res.status(403).json({ error: "NGO is pending admin approval" });
    }

    res.json({
      token: signToken({ _id: ngo._id, role: "ngo", email: ngo.email }),
      ngo: {
        id: ngo._id,
        name: ngo.ngoName,
        email: ngo.email,
        role: "ngo",
        verified: ngo.verified,
        approvalStatus: ngo.approvalStatus,
        impactScore: ngo.impactScore,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { router, authMiddleware, publicUser };
