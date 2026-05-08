const express  = require("express");
const mongoose = require("mongoose");
const { User, NGO, Cause, Donation, Transparency, Contact } = require("./models");
const { authMiddleware } = require("./authRoutes");

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════
//  CAUSES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/causes  — all active causes (for homepage cards)
router.get("/causes", async (req, res) => {
  try {
    const causes = await Cause.find({ active: true })
      .populate("assignedNgo", "name verified rating")
      .sort({ raised: -1 });
    res.json(causes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/causes/:id
router.get("/causes/:id", async (req, res) => {
  try {
    const cause = await Cause.findById(req.params.id)
      .populate("assignedNgo", "name verified rating tasksCompleted");
    if (!cause) return res.status(404).json({ error: "Cause not found" });
    res.json(cause);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  DONATIONS
// ════════════════════════════════════════════════════════════════════════════

// POST /api/donate  — authenticated user donates to a cause
router.post("/donate", authMiddleware, async (req, res) => {
  try {
    const { causeId, cause, amount } = req.body;
    const causeRef = causeId || cause;
    if (!causeRef || !amount || amount < 10)
      return res.status(400).json({ error: "Cause and minimum ₹10 required" });

    const causeDoc = mongoose.Types.ObjectId.isValid(causeRef)
      ? await Cause.findById(causeRef)
      : await Cause.findOne({ category: causeRef, active: true }).sort({ raised: -1 });
    if (!causeDoc || !causeDoc.active)
      return res.status(404).json({ error: "Cause not found or inactive" });

    // XP earned = 1 XP per ₹1 donated (min 10)
    const xpEarned = Math.floor(amount);

    // Create donation record
    const donation = await Donation.create({
      user:   req.user.id,
      cause:  causeDoc._id,
      ngo:    causeDoc.assignedNgo,
      amount: Number(amount),
      xpEarned,
      status: "pending",
      location: causeDoc.location || ""
    });

    // Update cause stats
    await Cause.findByIdAndUpdate(causeDoc._id, {
      $inc: { raised: amount, contributors: 1 }
    });

    // Update user stats + XP + badges
    const user = await User.findById(req.user.id);
    user.totalDonated  += Number(amount);
    user.donationCount += 1;
    user.xp            += xpEarned;
    user.lastDonation   = new Date();

    // Award badges
    if (user.donationCount === 1 && !user.badges.includes("First Donation"))
      user.badges.push("First Donation");
    if (user.donationCount >= 10 && !user.badges.includes("Consistent Giver"))
      user.badges.push("Consistent Giver");
    if (user.donationCount >= 100 && !user.badges.includes("Century Club"))
      user.badges.push("Century Club");
    if (user.xp >= 5000 && !user.badges.includes("Impact Creator"))
      user.badges.push("Impact Creator");

    await user.save();

    // If NGO assigned, update received amount
    if (causeDoc.assignedNgo) {
      await NGO.findByIdAndUpdate(causeDoc.assignedNgo, {
        $inc: { totalReceived: amount }
      });
    }

    res.status(201).json({
      message: "Donation successful!",
      donation: {
        id: donation._id,
        amount: donation.amount,
        status: donation.status,
        xpEarned,
      },
      user: {
        xp: user.xp,
        level: user.level,
        badges: user.badges,
        totalDonated: user.totalDonated,
        donationCount: user.donationCount
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/donations/history  — user's own donation history
router.get("/donations/history", authMiddleware, async (req, res) => {
  try {
    const donations = await Donation.find({ user: req.user.id })
      .populate("cause", "title icon category")
      .populate("ngo", "name location")
      .sort({ createdAt: -1 });
    res.json(donations);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  TRANSPARENCY LOG
// ════════════════════════════════════════════════════════════════════════════

// GET /api/transparency  — public feed of all completed works
router.get("/transparency", async (req, res) => {
  try {
    const { cause, ngo, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (cause) filter.cause = cause;
    if (ngo)   filter.ngo   = ngo;

    const logs = await Transparency.find(filter)
      .populate("ngo",   "name location verified rating")
      .populate("cause", "title icon category")
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await Transparency.countDocuments(filter);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  NGO PUBLIC DIRECTORY
// ════════════════════════════════════════════════════════════════════════════

// GET /api/ngos  — list verified NGOs sorted by rank
router.get("/ngos", async (req, res) => {
  try {
    const ngos = await NGO.find({ verified: true })
      .select("-password -volunteers")
      .sort({ impactScore: -1 });
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ngos/:id
router.get("/ngos/:id", async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id).select("-password");
    if (!ngo || !ngo.verified)
      return res.status(404).json({ error: "NGO not found" });

    // Get recent transparency logs for this NGO
    const logs = await Transparency.find({ ngo: req.params.id })
      .populate("cause", "title icon")
      .sort({ date: -1 })
      .limit(5);

    res.json({ ngo, recentWork: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  LEADERBOARD
// ════════════════════════════════════════════════════════════════════════════

// GET /api/leaderboard/donors
router.get("/leaderboard/donors", async (req, res) => {
  try {
    const donors = await User.find({ donationCount: { $gt: 0 } })
      .select("name xp level donationCount totalDonated badges")
      .sort({ xp: -1 })
      .limit(20);
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard/ngos
router.get("/leaderboard/ngos", async (req, res) => {
  try {
    const ngos = await NGO.find({ verified: true })
      .select("name impactScore tasksCompleted rating onTimeRate areaOfWork")
      .sort({ impactScore: -1 })
      .limit(20);
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  USER DASHBOARD
// ════════════════════════════════════════════════════════════════════════════

// GET /api/dashboard  — full dashboard data for logged-in user
router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    const donations = await Donation.find({ user: req.user.id })
      .populate("cause", "title icon category")
      .populate("ngo", "name location")
      .sort({ createdAt: -1 })
      .limit(10);

    // XP to next level
    const xpThresholds = { Beginner: 500, Contributor: 2000, "Active Supporter": 5000 };
    const nextXp = xpThresholds[user.level] || null;

    res.json({
      user,
      recentDonations: donations,
      nextLevelXp: nextXp,
      xpProgress: nextXp ? Math.round((user.xp / nextXp) * 100) : 100
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  CONTACT
// ════════════════════════════════════════════════════════════════════════════

// POST /api/contact
router.post("/contact", async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message)
      return res.status(400).json({ error: "All fields required" });
    await Contact.create({ name, email, message });
    res.json({ message: "Message sent! We will respond within 24 hours." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  STATS (for hero section)
// ════════════════════════════════════════════════════════════════════════════

// GET /api/stats
router.get("/stats", async (req, res) => {
  try {
    const [totalDonated, livesImpacted, verifiedNGOs, totalDonations] =
      await Promise.all([
        User.aggregate([{ $group: { _id: null, total: { $sum: "$totalDonated" } } }]),
        Transparency.countDocuments(),
        NGO.countDocuments({ verified: true }),
        Donation.countDocuments({ status: "verified" })
      ]);

    res.json({
      totalDonated:  totalDonated[0]?.total || 0,
      livesImpacted: livesImpacted * 10,   // approx 10 lives per task
      verifiedNGOs,
      totalDonations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
