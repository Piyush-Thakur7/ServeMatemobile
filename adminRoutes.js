const express  = require("express");
const jwt      = require("jsonwebtoken");
const { User, NGO, Cause, Donation, Transparency, Contact } = require("./models");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || "servemate_secret";

// ─── ADMIN AUTH MIDDLEWARE ────────────────────────────────────────────────────
const adminOnly = (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer "))
    return res.status(401).json({ error: "No token" });
  try {
    const decoded = jwt.verify(auth.split(" ")[1], JWT_SECRET);
    if (decoded.role !== "admin")
      return res.status(403).json({ error: "Admin only" });
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ─── NGO MANAGEMENT ──────────────────────────────────────────────────────────

// GET /api/admin/ngos/pending  — NGOs awaiting verification
router.get("/ngos/pending", adminOnly, async (req, res) => {
  try {
    const ngos = await NGO.find({ verified: false }).select("-password").sort({ createdAt: -1 });
    res.json(ngos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/ngos/all
router.get("/ngos/all", adminOnly, async (req, res) => {
  try {
    const ngos = await NGO.find().select("-password").sort({ createdAt: -1 });
    res.json(ngos);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/ngos/:id/verify  — approve an NGO
router.patch("/ngos/:id/verify", adminOnly, async (req, res) => {
  try {
    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      { verified: true, verifiedAt: new Date() },
      { new: true }
    ).select("-password");
    if (!ngo) return res.status(404).json({ error: "NGO not found" });
    res.json({ message: "NGO verified", ngo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/ngos/:id  — reject/remove NGO
router.delete("/ngos/:id", adminOnly, async (req, res) => {
  try {
    await NGO.findByIdAndDelete(req.params.id);
    res.json({ message: "NGO removed" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CAUSE MANAGEMENT ─────────────────────────────────────────────────────────

// POST /api/admin/causes  — create a new cause
router.post("/causes", adminOnly, async (req, res) => {
  try {
    const { title, description, icon, category, goal, impactPerRupee, assignedNgo } = req.body;
    if (!title || !description || !category || !goal)
      return res.status(400).json({ error: "Required fields missing" });

    const cause = await Cause.create({
      title, description, icon, category,
      goal: Number(goal), impactPerRupee, assignedNgo: assignedNgo || null
    });
    res.status(201).json(cause);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/causes/:id  — update cause
router.patch("/causes/:id", adminOnly, async (req, res) => {
  try {
    const cause = await Cause.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cause) return res.status(404).json({ error: "Cause not found" });
    res.json(cause);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /api/admin/causes/:id
router.delete("/causes/:id", adminOnly, async (req, res) => {
  try {
    await Cause.findByIdAndDelete(req.params.id);
    res.json({ message: "Cause deleted" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DONATION MANAGEMENT ──────────────────────────────────────────────────────

// GET /api/admin/donations  — all donations
router.get("/donations", adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const donations = await Donation.find(filter)
      .populate("user",  "name email")
      .populate("cause", "title")
      .populate("ngo",   "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Donation.countDocuments(filter);
    res.json({ donations, total });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/donations/:id/complete  — mark donation complete + add proof
router.patch("/donations/:id/complete", adminOnly, async (req, res) => {
  try {
    const { proofVideo, proofNote, location } = req.body;
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status: "completed", proofVideo, proofNote, location },
      { new: true }
    ).populate("cause ngo");

    if (!donation) return res.status(404).json({ error: "Donation not found" });

    // Add to transparency log
    await Transparency.create({
      donation:    donation._id,
      ngo:         donation.ngo?._id,
      cause:       donation.cause?._id,
      description: proofNote || `${donation.cause?.title} completed`,
      proofVideo,
      location,
      amount:      donation.amount,
      date:        new Date()
    });

    // Update NGO stats
    if (donation.ngo) {
      await NGO.findByIdAndUpdate(donation.ngo._id, {
        $inc: { tasksCompleted: 1, impactScore: Math.floor(donation.amount / 10) }
      });
    }

    res.json({ message: "Donation marked complete & transparency log created", donation });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/donations/:id/verify  — final verify (user can now see proof)
router.patch("/donations/:id/verify", adminOnly, async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status: "verified", verifiedAt: new Date() },
      { new: true }
    );
    if (!donation) return res.status(404).json({ error: "Donation not found" });
    res.json({ message: "Donation verified", donation });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── CONTACT MESSAGES ─────────────────────────────────────────────────────────

// GET /api/admin/contacts
router.get("/contacts", adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    res.json(messages);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/admin/contacts/:id/read
router.patch("/contacts/:id/read", adminOnly, async (req, res) => {
  try {
    await Contact.findByIdAndUpdate(req.params.id, { read: true });
    res.json({ message: "Marked as read" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PLATFORM OVERVIEW ────────────────────────────────────────────────────────

// GET /api/admin/overview
router.get("/overview", adminOnly, async (req, res) => {
  try {
    const [users, ngos, donations, pendingNgos, unreadMessages] = await Promise.all([
      User.countDocuments(),
      NGO.countDocuments({ verified: true }),
      Donation.aggregate([
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }
      ]),
      NGO.countDocuments({ verified: false }),
      Contact.countDocuments({ read: false })
    ]);

    res.json({
      totalUsers:    users,
      verifiedNGOs:  ngos,
      totalDonated:  donations[0]?.total || 0,
      totalDonations:donations[0]?.count || 0,
      pendingNGOs:   pendingNgos,
      unreadMessages
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NGO VOLUNTEER MANAGEMENT (NGO manages own volunteers) ────────────────────

// POST /api/admin/ngos/:id/volunteers  — add volunteer to NGO
router.post("/ngos/:id/volunteers", adminOnly, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      { $push: { volunteers: { name, email, phone } } },
      { new: true }
    ).select("-password");
    res.json({ message: "Volunteer added", ngo });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
