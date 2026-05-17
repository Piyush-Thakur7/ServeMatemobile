const express  = require("express");
const { User, NGO, Cause, Donation, Transparency, Contact } = require("./models");
const { authMiddleware } = require("./authRoutes");
const { mergeCoreCauses } = require("./services/causeCatalog");
const { getProgression } = require("./services/gamificationService");

const router = express.Router();

// ════════════════════════════════════════════════════════════════════════════
//  CAUSES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/causes  — all active causes (for homepage cards)
router.get("/causes", async (req, res) => {
  try {
    const verifiedNgoIds = await NGO.find({ verified: true }).distinct("_id");
    const causes = await Cause.find({ active: true, assignedNgo: { $in: verifiedNgoIds } })
      .populate("assignedNgo", "name verified rating")
      .sort({ raised: -1 });
    res.json(mergeCoreCauses(causes));
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

// POST /api/donate - authenticated user donates to a cause
router.post("/donate", authMiddleware, async (req, res) => {
  try {
    const { causeId, amount } = req.body;
    const safeAmount = Math.floor(Number(amount));
    if (!causeId || !Number.isFinite(safeAmount) || safeAmount < 10)
      return res.status(400).json({ error: "Cause and minimum amount of Rs 10 required" });
    const cause = await Cause.findOne({ _id: causeId, active: true }).populate("assignedNgo", "verified");
    if (!cause || !cause.active || !cause.assignedNgo || !cause.assignedNgo.verified)
      return res.status(404).json({ error: "This cause is not available until an approved NGO is assigned" });

    // XP earned = 1 XP per Rs 1 donated (min 10)
    const xpEarned = safeAmount;

    // Create donation record
    const donation = await Donation.create({
      user:   req.user.id,
      cause:  cause._id,
      ngo:    cause.assignedNgo,
      amount: safeAmount,
      xpEarned,
      status: "pending",
      location: cause.location || ""
    });

    // Update cause stats
    await Cause.findByIdAndUpdate(cause._id, {
      $inc: { raised: safeAmount, contributors: 1 }
    });

    // Update user stats + XP + badges
    const user = await User.findById(req.user.id);
    if (!user)
      return res.status(404).json({ error: "User not found" });
    user.totalDonated  += safeAmount;
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
    const progression = getProgression(user.xp);

    // If NGO assigned, update received amount
    if (cause.assignedNgo) {
      await NGO.findByIdAndUpdate(cause.assignedNgo, {
        $inc: { totalReceived: safeAmount }
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
        title: user.title,
        progression,
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

router.get("/donations", authMiddleware, async (req, res) => {
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
    const [verifiedNgoIds, verifiedDonationIds] = await Promise.all([
      NGO.find({ verified: true }).distinct("_id"),
      Donation.find({ status: "verified", proofVideo: { $nin: ["", null] } }).distinct("_id"),
    ]);
    const filter = {
      ngo: { $in: verifiedNgoIds },
      donation: { $in: verifiedDonationIds },
      proofVideo: { $nin: ["", null] },
    };
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

router.get("/ngo/:id", async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id).select("-password");
    if (!ngo || !ngo.verified)
      return res.status(404).json({ error: "NGO not found" });

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
      .select("name xp level title donationCount totalDonated badges avatar bio")
      .sort({ totalDonated: -1, xp: -1, donationCount: -1 })
      .limit(100);
    res.json(donors.map((donor) => {
      const item = donor.toObject();
      item.progression = getProgression(item.xp);
      return item;
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/leaderboard/ngos
router.get("/leaderboard/ngos", async (req, res) => {
  try {
    const ngos = await NGO.find({ verified: true })
      .select("name impactScore tasksCompleted rating onTimeRate areaOfWork location")
      .sort({ impactScore: -1 })
      .limit(100);
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/leaderboard/:type", async (req, res) => {
  if (req.params.type === "donors") {
    try {
      const donors = await User.find({ donationCount: { $gt: 0 } })
        .select("name xp level title donationCount totalDonated badges avatar bio")
        .sort({ totalDonated: -1, xp: -1, donationCount: -1 })
        .limit(100);
      return res.json(donors.map((donor) => {
        const item = donor.toObject();
        item.progression = getProgression(item.xp);
        return item;
      }));
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.params.type === "ngos") {
    try {
      const ngos = await NGO.find({ verified: true })
        .select("name impactScore tasksCompleted rating onTimeRate areaOfWork location")
        .sort({ impactScore: -1 })
        .limit(100);
      return res.json(ngos);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(404).json({ error: "Leaderboard not found" });
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

    const progression = getProgression(user.xp);

    res.json({
      user,
      recentDonations: donations,
      progression,
      nextLevelXp: progression.nextLevelXp,
      xpProgress: progression.progress
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    const payload = user.toObject();
    payload.progression = getProgression(payload.xp);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/profile", authMiddleware, async (req, res) => {
  try {
    const updates = {};
    if (typeof req.body.bio === "string") updates.bio = req.body.bio.slice(0, 500);
    if (typeof req.body.avatar === "string") updates.avatar = req.body.avatar.slice(0, 1000);

    const user = await User.findByIdAndUpdate(req.user.id, updates, { new: true }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const payload = user.toObject();
    payload.progression = getProgression(payload.xp);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/ngos/:id/volunteers", authMiddleware, async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    const user = await User.findById(req.user.id);
    if (!ngo || !ngo.verified) return res.status(404).json({ error: "NGO not found" });
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = ngo.volunteers.find((volunteer) => String(volunteer.user) === String(user._id));
    if (existing) return res.status(409).json({ error: "Volunteer request already exists" });

    ngo.volunteers.push({
      user: user._id,
      name: user.name,
      email: user.email,
      phone: req.body.phone || "",
      status: "requested",
      title: "Volunteer",
    });
    user.volunteerActivity.push({ ngo: ngo._id, status: "requested", title: "Volunteer" });

    await Promise.all([ngo.save(), user.save()]);
    res.status(201).json({ message: "Volunteer request sent", status: "requested" });
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
    const [totalDonated, verifiedTasks, verifiedNGOs, totalDonations] =
      await Promise.all([
        Donation.aggregate([{ $match: { status: "verified" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        Transparency.countDocuments({ proofVideo: { $nin: ["", null] } }),
        NGO.countDocuments({ verified: true }),
        Donation.countDocuments({ status: "verified" })
      ]);

    res.json({
      totalDonated:  totalDonated[0]?.total || 0,
      verifiedTasks,
      verifiedNGOs,
      totalDonations
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
