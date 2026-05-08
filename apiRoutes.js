const crypto = require("crypto");
const express = require("express");
const mongoose = require("mongoose");
const {
  User,
  NGO,
  Cause,
  Donation,
  Transparency,
  Contact,
  TokenTransaction,
  Activity,
  progressionForXp,
} = require("./models");
const { authMiddleware, publicUser } = require("./authRoutes");

const router = express.Router();
const ADMIN_EMAIL = "th.piyushsingh2007@gmail.com";
const contactWindow = new Map();

function sanitizeRegex(text) {
  return String(text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clientIp(req) {
  return req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
}

function hashIp(ip) {
  return crypto.createHash("sha256").update(`${process.env.CONTACT_SALT || "servemate"}:${ip}`).digest("hex");
}

function verifyRazorpaySignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const received = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET || !rawBody || !signature) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  const received = Buffer.from(signature || "");
  const expectedBuffer = Buffer.from(expected);
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(expectedBuffer, received);
}

async function createRazorpayOrder({ amountInPaise, receipt }) {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("Razorpay credentials are not configured");
  }

  const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountInPaise,
      currency: "INR",
      receipt,
      payment_capture: 1,
    }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.description || "Unable to create Razorpay order");
  return data;
}

async function creditTokenPurchase(transaction, paymentData = {}) {
  if (transaction.paymentStatus === "success") return transaction;
  if (paymentData.paymentId) {
    const existingPayment = await TokenTransaction.findOne({
      _id: { $ne: transaction._id },
      providerPaymentId: paymentData.paymentId,
      paymentStatus: "success",
    });
    if (existingPayment) {
      const error = new Error("Payment has already been credited");
      error.status = 409;
      throw error;
    }
  }

  const user = await User.findById(transaction.userId);
  if (!user) throw new Error("User not found");

  transaction.paymentStatus = "success";
  transaction.providerPaymentId = paymentData.paymentId || transaction.providerPaymentId;
  transaction.providerSignature = paymentData.signature || transaction.providerSignature;
  transaction.metadata = { ...(transaction.metadata || {}), verifiedAt: new Date().toISOString(), ...paymentData.metadata };
  await transaction.save();

  user.tokenBalance += transaction.amount;
  user.totalTokensPurchased += transaction.amount;
  user.totalImpact += transaction.amount;
  user.xp += transaction.amount;
  user.recalculateGamification();
  await user.save();

  await Activity.create({
    userId: user._id,
    type: "token_purchase",
    message: `${transaction.amount} virtual support tokens credited.`,
    xp: transaction.amount,
    tokens: transaction.amount,
    metadata: { transactionId: transaction._id, provider: transaction.provider },
  });

  return transaction;
}

function publicNgo(ngo) {
  return {
    id: ngo._id,
    _id: ngo._id,
    ngoName: ngo.ngoName,
    name: ngo.ngoName || ngo.name,
    description: ngo.description,
    founderName: ngo.founderName,
    email: ngo.email,
    phone: ngo.phone,
    location: ngo.location,
    documents: ngo.documents || [],
    verified: ngo.verified,
    approvalStatus: ngo.approvalStatus,
    impactScore: ngo.impactScore || 0,
    volunteers: ngo.volunteers || [],
    tasksCompleted: ngo.tasksCompleted || 0,
    areaOfWork: ngo.areaOfWork || "",
    createdAt: ngo.createdAt,
  };
}

router.get("/causes", async (req, res) => {
  try {
    const causes = await Cause.find({ active: true, assignedNgo: { $exists: true, $ne: null } })
      .populate({
        path: "assignedNgo",
        select: "ngoName name verified approvalStatus",
        match: { verified: true, approvalStatus: "approved" },
      })
      .sort({ createdAt: -1 });
    res.json(causes.filter((cause) => cause.assignedNgo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/causes/:id", async (req, res) => {
  try {
    const cause = await Cause.findOne({ _id: req.params.id, active: true, assignedNgo: { $exists: true, $ne: null } })
      .populate({
        path: "assignedNgo",
        select: "ngoName name verified approvalStatus impactScore",
        match: { verified: true, approvalStatus: "approved" },
      });
    if (!cause) return res.status(404).json({ error: "Cause not found" });
    if (!cause.assignedNgo) return res.status(404).json({ error: "Cause not found" });
    res.json(cause);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/tokens/order", authMiddleware, async (req, res) => {
  try {
    const tokenAmount = Math.floor(safeNumber(req.body.amount));
    if (!tokenAmount || tokenAmount < 10 || tokenAmount > 100000) {
      return res.status(400).json({ error: "Token purchase must be between 10 and 100000 tokens" });
    }

    const inrAmount = safeNumber(req.body.currencyAmount, tokenAmount);
    if (inrAmount <= 0) {
      return res.status(400).json({ error: "Payment amount must be positive" });
    }
    const transaction = await TokenTransaction.create({
      userId: req.user.id,
      amount: tokenAmount,
      currencyAmount: inrAmount,
      type: "purchase",
      paymentStatus: "created",
      provider: "razorpay",
    });

    const order = await createRazorpayOrder({
      amountInPaise: Math.round(inrAmount * 100),
      receipt: `sm_${transaction._id}`,
    });

    transaction.providerOrderId = order.id;
    transaction.paymentStatus = "pending";
    transaction.metadata = { razorpayOrder: order };
    await transaction.save();

    res.status(201).json({
      transactionId: transaction._id,
      orderId: order.id,
      keyId: process.env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      tokens: tokenAmount,
      upi: process.env.UPI_ID || "th.piyushsingh2007-1@okhdfcbank",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/tokens/verify", authMiddleware, async (req, res) => {
  try {
    const { transactionId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    if (!transactionId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ error: "Complete Razorpay verification details are required" });
    }
    const transaction = await TokenTransaction.findOne({
      _id: transactionId,
      userId: req.user.id,
      providerOrderId: razorpay_order_id,
    });
    if (!transaction) return res.status(404).json({ error: "Token transaction not found" });
    if (transaction.paymentStatus === "success") {
      const user = await User.findById(req.user.id).select("-password");
      return res.json({ message: "Tokens already credited", transaction, user: publicUser(user) });
    }
    if (!["created", "pending"].includes(transaction.paymentStatus)) {
      return res.status(409).json({ error: "Payment is no longer eligible for verification" });
    }
    if (!verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
      transaction.paymentStatus = "failed";
      await transaction.save();
      return res.status(400).json({ error: "Payment verification failed" });
    }

    await creditTokenPurchase(transaction, {
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });
    const user = await User.findById(req.user.id).select("-password");
    res.json({ message: "Tokens credited", transaction, user: publicUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

router.post("/tokens/webhook", async (req, res) => {
  try {
    if (!verifyWebhookSignature(req.rawBody, req.headers["x-razorpay-signature"])) {
      return res.status(400).json({ error: "Invalid webhook signature" });
    }
    const event = req.body;
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const orderId = payment?.order_id;
      const transaction = await TokenTransaction.findOne({ providerOrderId: orderId });
      if (transaction) {
        await creditTokenPurchase(transaction, {
          paymentId: payment.id,
          metadata: { webhookEvent: event.event },
        });
      }
    }
    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/tokens/history", authMiddleware, async (req, res) => {
  try {
    const transactions = await TokenTransaction.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(100);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function handleContribution(req, res) {
  const session = await mongoose.startSession();
  try {
    const tokenAmount = Math.floor(safeNumber(req.body.amount));
    const causeRef = req.body.causeId || req.body.cause;
    if (!tokenAmount || tokenAmount < 1) return res.status(400).json({ error: "Token amount is required" });
    if (!causeRef || !mongoose.Types.ObjectId.isValid(causeRef)) {
      return res.status(400).json({ error: "Choose an approved cause before using tokens" });
    }

    let responsePayload;
    await session.withTransaction(async () => {
      const user = await User.findById(req.user.id).session(session);
      if (!user) throw new Error("User not found");
      if (user.tokenBalance < tokenAmount) {
        const error = new Error("Insufficient token balance. Purchase tokens before contributing.");
        error.status = 400;
        throw error;
      }

      const causeDoc = await Cause.findOne({
        _id: causeRef,
        active: true,
        assignedNgo: { $exists: true, $ne: null },
      }).session(session);
      if (!causeDoc) {
        const error = new Error("Cause is not available for token spending");
        error.status = 400;
        throw error;
      }
      const approvedNgo = await NGO.findOne({
        _id: causeDoc.assignedNgo,
        verified: true,
        approvalStatus: "approved",
      }).session(session);
      if (!approvedNgo) {
        const error = new Error("Cause is awaiting NGO approval");
        error.status = 400;
        throw error;
      }

      user.tokenBalance -= tokenAmount;
      user.totalImpact += tokenAmount;
      user.xp += Math.ceil(tokenAmount / 2);
      user.donationCount += 1;
      user.totalDonated += tokenAmount;
      user.lastDonation = new Date();
      user.recalculateGamification();
      await user.save({ session });

      const contribution = await Donation.create(
        [{
          user: user._id,
          cause: causeDoc?._id,
          ngo: causeDoc?.assignedNgo,
          amount: tokenAmount,
          xpEarned: Math.ceil(tokenAmount / 2),
          status: "pending",
        }],
        { session }
      );

      await TokenTransaction.create(
        [{
          userId: user._id,
          amount: tokenAmount,
          type: "spend",
          paymentStatus: "success",
          provider: "system",
          metadata: { causeId: causeDoc?._id, contributionId: contribution[0]._id },
        }],
        { session }
      );

      if (causeDoc) {
        await Cause.findByIdAndUpdate(causeDoc._id, { $inc: { raised: tokenAmount, contributors: 1 } }, { session });
      }

      await Activity.create(
        [{
          userId: user._id,
          type: "token_contribution",
          message: `${tokenAmount} virtual support tokens contributed.`,
          xp: Math.ceil(tokenAmount / 2),
          tokens: tokenAmount,
          metadata: { causeId: causeDoc?._id },
        }],
        { session }
      );

      responsePayload = {
        message: "Virtual support tokens contributed.",
        donation: {
          id: contribution[0]._id,
          amount: tokenAmount,
          status: "pending",
          xpEarned: Math.ceil(tokenAmount / 2),
        },
        contribution: contribution[0],
        user: publicUser(user),
      };
    });

    res.status(201).json(responsePayload);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  } finally {
    await session.endSession();
  }
}

router.post("/contribute", authMiddleware, handleContribution);
router.post("/donate", authMiddleware, handleContribution);

router.get("/donations/history", authMiddleware, async (req, res) => {
  try {
    const contributions = await Donation.find({ user: req.user.id })
      .populate("cause", "title icon category")
      .populate("ngo", "ngoName name location")
      .sort({ createdAt: -1 })
      .limit(100);
    res.json(contributions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/transparency", async (req, res) => {
  try {
    const { cause, ngo, page = 1, limit = 10 } = req.query;
    const filter = {};
    if (cause) filter.cause = cause;
    if (ngo) filter.ngo = ngo;
    const pageSize = Math.min(Number(limit) || 10, 50);
    const logs = await Transparency.find(filter)
      .populate("ngo", "ngoName name location verified approvalStatus")
      .populate("cause", "title icon category")
      .sort({ date: -1 })
      .skip((Number(page) - 1) * pageSize)
      .limit(pageSize);
    const total = await Transparency.countDocuments(filter);
    res.json({ logs, total, page: Number(page), pages: Math.ceil(total / pageSize) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/ngos", async (req, res) => {
  try {
    const query = { verified: true, approvalStatus: "approved" };
    if (req.query.q) {
      query.$or = [
        { ngoName: new RegExp(sanitizeRegex(req.query.q), "i") },
        { location: new RegExp(sanitizeRegex(req.query.q), "i") },
      ];
    }
    const ngos = await NGO.find(query).select("-password").sort({ impactScore: -1, createdAt: -1 });
    res.json(ngos.map(publicNgo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/ngos/:id", async (req, res) => {
  try {
    const ngo = await NGO.findOne({ _id: req.params.id, verified: true, approvalStatus: "approved" }).select("-password");
    if (!ngo) return res.status(404).json({ error: "NGO not found" });
    const recentWork = await Transparency.find({ ngo: ngo._id }).populate("cause", "title icon").sort({ date: -1 }).limit(5);
    res.json({ ngo: publicNgo(ngo), recentWork });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/leaderboard/donors", async (req, res) => {
  try {
    const donors = await User.find({ $or: [{ totalTokensPurchased: { $gt: 0 } }, { xp: { $gt: 0 } }] })
      .select("name username profileImage xp level title badges tokenBalance totalTokensPurchased totalImpact")
      .sort({ totalTokensPurchased: -1, xp: -1, totalImpact: -1 })
      .limit(100);
    res.json(donors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/leaderboard/ngos", async (req, res) => {
  try {
    const ngos = await NGO.find({ verified: true, approvalStatus: "approved" })
      .select("ngoName name location impactScore volunteers tasksCompleted areaOfWork")
      .sort({ impactScore: -1 })
      .limit(100);
    res.json(ngos.map(publicNgo));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/dashboard", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });

    const [transactions, contributions, recentActivity, leaderboardAhead] = await Promise.all([
      TokenTransaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
      Donation.find({ user: user._id }).populate("cause", "title icon category").populate("ngo", "ngoName name location").sort({ createdAt: -1 }).limit(10),
      Activity.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10),
      User.countDocuments({
        $or: [
          { totalTokensPurchased: { $gt: user.totalTokensPurchased } },
          { totalTokensPurchased: user.totalTokensPurchased, xp: { $gt: user.xp } },
          { totalTokensPurchased: user.totalTokensPurchased, xp: user.xp, totalImpact: { $gt: user.totalImpact } },
        ],
      }),
    ]);

    const progression = progressionForXp(user.xp);
    res.json({
      user: publicUser(user),
      progression,
      tokenTransactions: transactions,
      recentDonations: contributions,
      recentActivity,
      leaderboardPosition: user.totalImpact > 0 || user.xp > 0 ? leaderboardAhead + 1 : null,
      impactStats: {
        virtualTokensContributed: user.totalImpact || 0,
        tokenBalance: user.tokenBalance || 0,
        totalTokensPurchased: user.totalTokensPurchased || 0,
      },
      nextLevelXp: progression.nextLevelXp,
      xpProgress: progression.xpProgress,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch("/profile", authMiddleware, async (req, res) => {
  try {
    const allowed = {};
    ["name", "username", "bio", "profileImage"].forEach((key) => {
      if (typeof req.body[key] === "string") allowed[key] = req.body[key].trim();
    });
    const user = await User.findByIdAndUpdate(req.user.id, allowed, { new: true, runValidators: true }).select("-password");
    res.json({ user: publicUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message, website } = req.body;
    if (website) return res.status(400).json({ error: "Spam rejected" });
    if (!name || !email || !message) return res.status(400).json({ error: "Name, email, and message are required" });

    const ip = clientIp(req);
    const key = hashIp(ip);
    const now = Date.now();
    const recent = contactWindow.get(key) || [];
    const active = recent.filter((time) => now - time < 15 * 60 * 1000);
    if (active.length >= 3) return res.status(429).json({ error: "Too many messages. Please try again later." });
    active.push(now);
    contactWindow.set(key, active);

    const contact = await Contact.create({
      name,
      email,
      subject: subject || "ServeMATE contact",
      message,
      ipHash: key,
    });

    if (process.env.RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.CONTACT_FROM_EMAIL || "ServeMATE <onboarding@resend.dev>",
          to: [process.env.CONTACT_TO_EMAIL || ADMIN_EMAIL],
          subject: `[ServeMATE] ${contact.subject}`,
          text: `From: ${name} <${email}>\n\n${message}`,
        }),
      });
    }

    res.status(201).json({ message: "Message saved and queued for review.", id: contact._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/stats", async (req, res) => {
  try {
    const [tokenStats, verifiedNGOs, users, transactions] = await Promise.all([
      User.aggregate([{ $group: { _id: null, tokens: { $sum: "$totalTokensPurchased" }, impact: { $sum: "$totalImpact" } } }]),
      NGO.countDocuments({ verified: true, approvalStatus: "approved" }),
      User.countDocuments(),
      TokenTransaction.countDocuments({ paymentStatus: "success" }),
    ]);
    res.json({
      totalTokensPurchased: tokenStats[0]?.tokens || 0,
      totalImpact: tokenStats[0]?.impact || 0,
      verifiedNGOs,
      totalUsers: users,
      successfulTokenTransactions: transactions,
      totalDonated: 0,
      livesImpacted: tokenStats[0]?.impact || 0,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
