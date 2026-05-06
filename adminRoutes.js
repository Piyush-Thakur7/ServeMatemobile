const express = require('express');
const router = express.Router();
const { User, NGO, Donation, TokenRequest } = require('./models');

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const jwt = require('jsonwebtoken');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

router.get('/stats', authenticate, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDonations = await Donation.countDocuments();
    const totalTokens = await User.aggregate([ { $group: { _id: null, sum: { $sum: "$tokens" } } } ]);
    const pendingTokens = await TokenRequest.countDocuments({ status: 'Pending' });
    res.json({
      users: totalUsers,
      donations: totalDonations,
      tokens: totalTokens[0]?.sum || 0,
      pendingRequests: pendingTokens
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/token-requests', authenticate, async (req, res) => {
  try {
    const requests = await TokenRequest.find({ status: 'Pending' }).populate('userId');
    res.json(requests);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/approve-tokens/:id', authenticate, async (req, res) => {
  try {
    const request = await TokenRequest.findById(req.params.id);
    if (!request || request.status !== 'Pending') return res.status(400).json({ error: 'Invalid request' });

    const user = await User.findById(request.userId);
    user.tokens += request.amountRequested;

    request.status = 'Approved';
    request.processedAt = Date.now();

    await user.save();
    await request.save();
    res.json({ message: 'Tokens approved and added to user account!' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/reject-tokens/:id', authenticate, async (req, res) => {
  try {
    const request = await TokenRequest.findById(req.params.id);
    request.status = 'Rejected';
    await request.save();
    res.json({ message: 'Token request rejected.' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/users', authenticate, async (req, res) => {
  try {
    const users = await User.find().sort({ xp: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/ngos', authenticate, async (req, res) => {
  try {
    const ngos = await NGO.find();
    res.json(ngos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/verify-ngo/:id', authenticate, async (req, res) => {
  try {
    const ngo = await NGO.findByIdAndUpdate(req.params.id, { isVerified: true }, { new: true });
    res.json({ message: 'NGO verified successfully', ngo });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
