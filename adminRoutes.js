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

router.get("/causes", adminOnly, async (req, res) => {
  try {
    const causes = await Cause.find()
      .populate("assignedNgo", "name verified")
      .sort({ createdAt: -1 });
    return res.json(causes);
  } catch (err) {
    console.error("[admin] Cause list failed:", err.message);
    return res.status(500).json({ error: "Unable to load causes" });
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
    if (!title || !description || !category || !goal || !assignedNgo) {
      return res.status(400).json({ error: "Title, description, category, goal, and approved NGO are required" });
    }

    const ngo = await NGO.findOne({ _id: assignedNgo, verified: true });
    if (!ngo) {
      return res.status(400).json({ error: "Cause must be assigned to an approved NGO" });
    }

    const cause = await Cause.create({
      title,
      description,
      icon: icon || "SM",
      category,
      goal: Number(goal),
      impactPerRupee: impactPerRupee || "Real impact tracked after verification",
      assignedNgo,
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
    const donation = await Donation.findById(req.params.id).populate("cause ngo");

    if (!donation) {
      return res.status(404).json({ error: "Donation not found" });
    }

    if (!donation.proofVideo) {
      return res.status(400).json({ error: "A real proof video is required before public verification" });
    }

    if (!donation.ngo || !donation.ngo.verified) {
      return res.status(400).json({ error: "Donation must be assigned to an approved NGO before verification" });
    }

    donation.status = "verified";
    donation.verifiedAt = new Date();
    await donation.save();

    await Transparency.findOneAndUpdate(
      { donation: donation._id },
      {
        donation: donation._id,
        ngo: donation.ngo._id,
        cause: donation.cause?._id,
        description: donation.proofNote || `${donation.cause?.title || "Donation"} verified`,
        proofVideo: donation.proofVideo,
        location: donation.location || "",
        amount: donation.amount,
        date: new Date(),
      },
      { upsert: true, new: true }
    );

    return res.json({ message: "Donation verified", donation });
  } catch (err) {
    console.error("[admin] Donation verification failed:", err.message);
    return res.status(500).json({ error: "Unable to verify donation" });
  }
});

router.get("/users", adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role xp level title totalDonated donationCount badges createdAt")
      .sort({ createdAt: -1 });
    return res.json(users);
  } catch (err) {
    console.error("[admin] User list failed:", err.message);
    return res.status(500).json({ error: "Unable to load users" });
  }
});

router.post("/users/:id/reset-activity", adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const donations = await Donation.find({ user: user._id }).select("_id cause ngo amount");
    const donationIds = donations.map((donation) => donation._id);

    await Transparency.deleteMany({ donation: { $in: donationIds } });
    await Donation.deleteMany({ user: user._id });

    for (const donation of donations) {
      if (donation.cause) {
        await Cause.findByIdAndUpdate(donation.cause, {
          $inc: { raised: -Number(donation.amount || 0), contributors: -1 },
        });
      }
      if (donation.ngo) {
        await NGO.findByIdAndUpdate(donation.ngo, {
          $inc: { totalReceived: -Number(donation.amount || 0) },
        });
      }
    }

    user.xp = 0;
    user.level = 1;
    user.title = "Beginner";
    user.badges = [];
    user.totalDonated = 0;
    user.donationCount = 0;
    user.lastDonation = undefined;
    user.streak = 0;
    await user.save();

    return res.json({ message: "User donations, XP, badges, and totals reset", userId: user._id });
  } catch (err) {
    console.error("[admin] User activity reset failed:", err.message);
    return res.status(500).json({ error: "Unable to reset user activity" });
  }
});

router.post("/reset/all-activity", adminOnly, async (req, res) => {
  try {
    if (req.body.confirmation !== "RESET_ALL_ACTIVITY") {
      return res.status(400).json({ error: "confirmation must be RESET_ALL_ACTIVITY" });
    }

    await Promise.all([
      Donation.deleteMany({}),
      Transparency.deleteMany({}),
      Cause.updateMany({}, { $set: { raised: 0, contributors: 0 } }),
      NGO.updateMany({}, { $set: { totalReceived: 0, impactScore: 0, tasksCompleted: 0 } }),
      User.updateMany(
        {},
        {
          $set: {
            xp: 0,
            level: 1,
            title: "Beginner",
            badges: [],
            totalDonated: 0,
            donationCount: 0,
            streak: 0,
          },
          $unset: { lastDonation: "" },
        }
      ),
    ]);

    return res.json({ message: "All transactions, XP, badges, and public proof activity reset" });
  } catch (err) {
    console.error("[admin] Global reset failed:", err.message);
    return res.status(500).json({ error: "Unable to reset platform activity" });
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
