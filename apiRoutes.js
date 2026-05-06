const express = require('express');
const router = express.Router();
const { User, Donation, NGO, Task } = require('./models');

// Middleware to verify token
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// User Profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Make a Donation (Updated for Token Economy)
router.post('/donate', authenticate, async (req, res) => {
  try {
    const { amount, cause, ngoId } = req.body;
    const user = await User.findById(req.userId);

    if (!user || user.tokens < amount) {
      return res.status(400).json({ error: 'Insufficient tokens. Please acquire more tokens!' });
    }

    const donation = new Donation({ userId: req.userId, amount, cause, ngoId });
    await donation.save();

    // Deduct Tokens and Add XP
    user.tokens -= amount;
    user.totalDonated += amount;
    user.xp += 10;

    // Level calculation logic
    if (user.xp >= 5000) user.level = 'Legend';
    else if (user.xp >= 2500) user.level = 'Champion';
    else if (user.xp >= 1200) user.level = 'Impact Creator';
    else if (user.xp >= 600) user.level = 'Active Supporter';
    else if (user.xp >= 200) user.level = 'Contributor';
    else user.level = 'Beginner';

    await user.save();
    res.json({ message: 'Donation successful!', currentTokens: user.tokens, xpEarned: 10 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Request Tokens (Simulated payment via UPI screenshot)
router.post('/request-tokens', authenticate, async (req, res) => {
  try {
    const { amount, screenshotUrl } = req.body;
    const request = new TokenRequest({
      userId: req.userId,
      amountRequested: amount,
      screenshotUrl: screenshotUrl
    });
    await request.save();
    res.json({ message: 'Token request submitted! Admin will verify your payment.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Get User Token Status
router.get('/token-status', authenticate, async (req, res) => {
  try {
    const requests = await TokenRequest.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get User Donations History
router.get('/donations', authenticate, async (req, res) => {
  try {
    const history = await Donation.find({ userId: req.userId }).sort({ date: -1 }).populate('ngoId');
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all NGOs
router.get('/ngos', async (req, res) => {
  try {
    const ngos = await NGO.find().sort({ impactScore: -1 });
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get NGO Profile
router.get('/ngo/:id', async (req, res) => {
  try {
    const ngo = await NGO.findById(req.params.id);
    res.json(ngo);
  } catch (err) {
    res.status(404).json({ error: 'NGO not found' });
  }
});

// Leaderboard - Donors
router.get('/leaderboard/donors', async (req, res) => {
  try {
    const topDonors = await User.find().sort({ xp: -1 }).limit(10);
    res.json(topDonors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leaderboard - NGOs
router.get('/leaderboard/ngos', async (req, res) => {
  try {
    const topNGOs = await NGO.find().sort({ impactScore: -1 }).limit(10);
    res.json(topNGOs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
