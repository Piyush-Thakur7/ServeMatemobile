const express = require("express");
const { User, NGO, Cause, Donation, Transparency, Contact } = require("./models");
const { adminOnly } = require("./authUtils");

const router = express.Router();

router.get("/ngos/pending", adminOnly, async (req, res) => {
  try {
    const ngos = await NGO.find({ verified: false }).select("-password").sort({ createdAt: -1 });
    return res.json(ngos);
  } catch (err) {
    console.error("[admin] Pending NGOs failed:", err.message);
    return res.status(500).json({ error: "Unable to load pending NGOs" });
  }
});

router.get("/ngos/all", adminOnly, async (req, res) => {
  try {
    const ngos = await NGO.find().select("-password").sort({ createdAt: -1 });
    return res.json(ngos);
  } catch (err) {
    console.error("[admin] NGO list failed:", err.message);
    return res.status(500).json({ error: "Unable to load NGOs" });
  }
});

router.patch("/ngos/:id/verify", adminOnly, async (req, res) => {
  try {
    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      { verified: true, verifiedAt: new Date() },
      { new: true }
    ).select("-password");

    if (!ngo) {
      return res.status(404).json({ error: "NGO not found" });
    }

    return res.json({ message: "NGO verified", ngo });
  } catch (err) {
    console.error("[admin] NGO verification failed:", err.message);
    return res.status(500).json({ error: "Unable to verify NGO" });
  }
});

router.delete("/ngos/:id", adminOnly, async (req, res) => {
  try {
    const ngo = await NGO.findByIdAndDelete(req.params.id);
    if (!ngo) {
      return res.status(404).json({ error: "NGO not found" });
    }
    return res.json({ message: "NGO removed" });
  } catch (err) {
    console.error("[admin] NGO removal failed:", err.message);
    return res.status(500).json({ error: "Unable to remove NGO" });
  }
});

router.post("/causes", adminOnly, async (req, res) => {
  try {
    const { title, description, icon, category, goal, impactPerRupee, assignedNgo } = req.body;
    if (!title || !description || !category || !goal) {
      return res.status(400).json({ error: "Required fields missing" });
    }

    const cause = await Cause.create({
      title,
      description,
      icon,
      category,
      goal: Number(goal),
      impactPerRupee,
      assignedNgo: assignedNgo || null,
    });

    return res.status(201).json(cause);
  } catch (err) {
    console.error("[admin] Cause creation failed:", err.message);
    return res.status(500).json({ error: "Unable to create cause" });
  }
});

router.patch("/causes/:id", adminOnly, async (req, res) => {
  try {
    const cause = await Cause.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!cause) {
      return res.status(404).json({ error: "Cause not found" });
    }
    return res.json(cause);
  } catch (err) {
    console.error("[admin] Cause update failed:", err.message);
    return res.status(500).json({ error: "Unable to update cause" });
  }
});

router.delete("/causes/:id", adminOnly, async (req, res) => {
  try {
    const cause = await Cause.findByIdAndDelete(req.params.id);
    if (!cause) {
      return res.status(404).json({ error: "Cause not found" });
    }
    return res.json({ message: "Cause deleted" });
  } catch (err) {
    console.error("[admin] Cause deletion failed:", err.message);
    return res.status(500).json({ error: "Unable to delete cause" });
  }
});

router.get("/donations", adminOnly, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const pageNumber = Math.max(Number(page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const filter = status ? { status } : {};

    const donations = await Donation.find(filter)
      .populate("user", "name email")
      .populate("cause", "title")
      .populate("ngo", "name")
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * pageSize)
      .limit(pageSize);

    const total = await Donation.countDocuments(filter);
    return res.json({ donations, total });
  } catch (err) {
    console.error("[admin] Donation list failed:", err.message);
    return res.status(500).json({ error: "Unable to load donations" });
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

    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    await Transparency.create({
      donation: donation._id,
      ngo: donation.ngo?._id,
      cause: donation.cause?._id,
      description: proofNote || `${donation.cause?.title || "Donation"} completed`,
      proofVideo,
      location,
      amount: donation.amount,
      date: new Date(),
    });

    if (donation.ngo) {
      await NGO.findByIdAndUpdate(donation.ngo._id, {
        $inc: { tasksCompleted: 1, impactScore: Math.floor(donation.amount / 10) },
      });
    }

    return res.json({ message: "Donation marked complete and transparency log created", donation });
  } catch (err) {
    console.error("[admin] Donation completion failed:", err.message);
    return res.status(500).json({ error: "Unable to complete donation" });
  }
});

router.patch("/donations/:id/verify", adminOnly, async (req, res) => {
  try {
    const donation = await Donation.findByIdAndUpdate(
      req.params.id,
      { status: "verified", verifiedAt: new Date() },
      { new: true }
    );

    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    return res.json({ message: "Donation verified", donation });
  } catch (err) {
    console.error("[admin] Donation verification failed:", err.message);
    return res.status(500).json({ error: "Unable to verify donation" });
  }
});

router.get("/contacts", adminOnly, async (req, res) => {
  try {
    const messages = await Contact.find().sort({ createdAt: -1 });
    return res.json(messages);
  } catch (err) {
    console.error("[admin] Contact list failed:", err.message);
    return res.status(500).json({ error: "Unable to load contacts" });
  }
});

router.patch("/contacts/:id/read", adminOnly, async (req, res) => {
  try {
    const contact = await Contact.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
    if (!contact) {
      return res.status(404).json({ error: "Contact not found" });
    }
    return res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("[admin] Contact update failed:", err.message);
    return res.status(500).json({ error: "Unable to update contact" });
  }
});

router.get("/overview", adminOnly, async (req, res) => {
  try {
    const [users, ngos, donations, pendingNgos, unreadMessages] = await Promise.all([
      User.countDocuments(),
      NGO.countDocuments({ verified: true }),
      Donation.aggregate([{ $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } }]),
      NGO.countDocuments({ verified: false }),
      Contact.countDocuments({ read: false }),
    ]);

    return res.json({
      totalUsers: users,
      verifiedNGOs: ngos,
      totalDonated: donations[0]?.total || 0,
      totalDonations: donations[0]?.count || 0,
      pendingNGOs: pendingNgos,
      unreadMessages,
    });
  } catch (err) {
    console.error("[admin] Overview failed:", err.message);
    return res.status(500).json({ error: "Unable to load overview" });
  }
});

router.post("/ngos/:id/volunteers", adminOnly, async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    const ngo = await NGO.findByIdAndUpdate(
      req.params.id,
      { $push: { volunteers: { name, email, phone } } },
      { new: true }
    ).select("-password");

    if (!ngo) {
      return res.status(404).json({ error: "NGO not found" });
    }

    return res.json({ message: "Volunteer added", ngo });
  } catch (err) {
    console.error("[admin] Volunteer creation failed:", err.message);
    return res.status(500).json({ error: "Unable to add volunteer" });
  }
});

module.exports = router;
