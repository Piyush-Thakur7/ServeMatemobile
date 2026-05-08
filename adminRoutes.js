const express = require("express");
const {
  User,
  NGO,
  Cause,
  Donation,
  Transparency,
  Contact,
  TokenTransaction,
  Badge,
  Announcement,
  Activity,
  badgeCatalog,
} = require("./models");
const { adminOnly } = require("./authUtils");

const router = express.Router();

function pageOptions(req) {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 100);
  return { page, limit, skip: (page - 1) * limit };
}

async function approveNgo(req, res) {
  const ngo = await NGO.findByIdAndUpdate(
    req.params.id,
    {
      approvalStatus: "approved",
      verified: true,
      verifiedAt: new Date(),
      reviewedAt: new Date(),
      reviewedBy: req.admin._id,
      rejectionReason: "",
    },
    { new: true, runValidators: true }
  ).select("-password");
  if (!ngo) return res.status(404).json({ error: "NGO not found" });
  return res.json({ message: "NGO approved and visible publicly", ngo });
}

router.get("/overview", adminOnly, async (req, res) => {
  try {
    const [users, admins, ngos, pendingNGOs, rejectedNGOs, tokenStats, contacts, activity] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "admin" }),
      NGO.countDocuments({ verified: true, approvalStatus: "approved" }),
      NGO.countDocuments({ approvalStatus: "pending" }),
      NGO.countDocuments({ approvalStatus: "rejected" }),
      TokenTransaction.aggregate([
        { $group: { _id: "$paymentStatus", totalTokens: { $sum: "$amount" }, totalInr: { $sum: "$currencyAmount" }, count: { $sum: 1 } } },
      ]),
      Contact.countDocuments({ read: false }),
      Activity.countDocuments({ createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ]);

    res.json({
      totalUsers: users,
      adminUsers: admins,
      verifiedNGOs: ngos,
      pendingNGOs,
      rejectedNGOs,
      unreadMessages: contacts,
      activityLast24h: activity,
      tokenTransactions: tokenStats,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/users", adminOnly, async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req);
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const [users, total] = await Promise.all([
      User.find(filter).select("-password").sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ users, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/users/:id", adminOnly, async (req, res) => {
  try {
    if (String(req.admin._id) === String(req.params.id)) {
      return res.status(400).json({ error: "Admin cannot delete their own account" });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    await Promise.all([
      TokenTransaction.deleteMany({ userId: user._id }),
      Activity.deleteMany({ userId: user._id }),
    ]);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/transactions", adminOnly, async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req);
    const filter = {};
    if (req.query.status) filter.paymentStatus = req.query.status;
    if (req.query.type) filter.type = req.query.type;
    const [transactions, total] = await Promise.all([
      TokenTransaction.find(filter).populate("userId", "name email role").sort({ createdAt: -1 }).skip(skip).limit(limit),
      TokenTransaction.countDocuments(filter),
    ]);
    res.json({ transactions, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/ngos/pending", adminOnly, async (req, res) => {
  try {
    const ngos = await NGO.find({ approvalStatus: "pending" }).select("-password").sort({ createdAt: -1 });
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/ngos/all", adminOnly, async (req, res) => {
  try {
    const ngos = await NGO.find().select("-password").sort({ createdAt: -1 });
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/ngos/:id/approve", adminOnly, async (req, res) => {
  try {
    return await approveNgo(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/ngos/:id/verify", adminOnly, async (req, res) => {
  try {
    return await approveNgo(req, res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/ngos/:id/reject", adminOnly, async (req, res) => {
  try {
    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      {
        approvalStatus: "rejected",
        verified: false,
        reviewedAt: new Date(),
        reviewedBy: req.admin._id,
        rejectionReason: req.body.reason || "",
      },
      { new: true, runValidators: true }
    ).select("-password");
    if (!ngo) return res.status(404).json({ error: "NGO not found" });
    res.json({ message: "NGO rejected", ngo });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/ngos/:id", adminOnly, async (req, res) => {
  try {
    const ngo = await NGO.findByIdAndDelete(req.params.id);
    if (!ngo) return res.status(404).json({ error: "NGO not found" });
    res.json({ message: "NGO removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/causes", adminOnly, async (req, res) => {
  try {
    const { title, description, icon, category, goal, impactPerRupee, assignedNgo } = req.body;
    if (!title || !description || !category) return res.status(400).json({ error: "Title, description, and category are required" });
    const cause = await Cause.create({
      title,
      description,
      icon,
      category,
      goal: Number(goal) || 0,
      impactPerRupee: impactPerRupee || "Virtual support tokens",
      assignedNgo: assignedNgo || null,
    });
    res.status(201).json(cause);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/causes/:id", adminOnly, async (req, res) => {
  try {
    const cause = await Cause.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!cause) return res.status(404).json({ error: "Cause not found" });
    res.json(cause);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete("/causes/:id", adminOnly, async (req, res) => {
  try {
    await Cause.findByIdAndDelete(req.params.id);
    res.json({ message: "Cause deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/donations", adminOnly, async (req, res) => {
  try {
    const { page, limit, skip } = pageOptions(req);
    const filter = req.query.status ? { status: req.query.status } : {};
    const [donations, total] = await Promise.all([
      Donation.find(filter)
        .populate("user", "name email")
        .populate("cause", "title")
        .populate("ngo", "ngoName name")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Donation.countDocuments(filter),
    ]);
    res.json({ donations, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/donations/:id/complete", adminOnly, async (req, res) => {
  try {
    const { proofVideo, proofNote, location } = req.body;
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status: "completed", proofVideo, proofNote, location },
      { new: true }
    ).populate("cause ngo");
    if (!donation) return res.status(404).json({ error: "Contribution not found" });

    await Transparency.create({
      donation: donation._id,
      ngo: donation.ngo?._id,
      cause: donation.cause?._id,
      description: proofNote || `${donation.cause?.title || "Support activity"} completed`,
      proofVideo,
      location,
      amount: donation.amount,
      date: new Date(),
    });

    if (donation.ngo) {
      await NGO.findByIdAndUpdate(donation.ngo._id, {
        $inc: { tasksCompleted: 1, impactScore: Math.floor(donation.amount) },
      });
    }

    res.json({ message: "Contribution marked complete and transparency log created", donation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/donations/:id/verify", adminOnly, async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status: "verified", verifiedAt: new Date() },
      { new: true }
    );
    if (!donation) return res.status(404).json({ error: "Contribution not found" });
    res.json({ message: "Contribution verified", donation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/contacts", adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 }).limit(200);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/contacts/:id/read", adminOnly, async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/badges", adminOnly, async (req, res) => {
  try {
    const existing = await Badge.find().sort({ name: 1 });
    if (existing.length) return res.json(existing);
    const seeded = await Badge.insertMany(badgeCatalog);
    res.json(seeded);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/badges", adminOnly, async (req, res) => {
  try {
    const { key, name, description, active = true } = req.body;
    if (!key || !name) return res.status(400).json({ error: "Badge key and name are required" });
    const badge = await Badge.findOneAndUpdate(
      { key },
      { key, name, description, active },
      { new: true, upsert: true, runValidators: true }
    );
    res.status(201).json(badge);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/announcements", adminOnly, async (req, res) => {
  try {
    const { title, message, audience = "all" } = req.body;
    if (!title || !message) return res.status(400).json({ error: "Title and message are required" });
    const announcement = await Announcement.create({ title, message, audience, createdBy: req.admin._id });
    res.status(201).json(announcement);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/analytics", adminOnly, async (req, res) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [registrations, tokenVolume, contacts, logins] = await Promise.all([
      User.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      TokenTransaction.aggregate([{ $match: { createdAt: { $gte: since }, paymentStatus: "success" } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, tokens: { $sum: "$amount" }, inr: { $sum: "$currencyAmount" }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Contact.aggregate([{ $match: { createdAt: { $gte: since } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Activity.aggregate([{ $match: { createdAt: { $gte: since }, type: { $in: ["login", "daily_login"] } } }, { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
    ]);
    res.json({ registrations, tokenVolume, contacts, logins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/leaderboard/recalculate", adminOnly, async (req, res) => {
  try {
    const users = await User.find();
    for (const user of users) {
      user.recalculateGamification();
      await user.save();
    }
    res.json({ message: "Leaderboard inputs recalculated", usersUpdated: users.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
