const express = require('express');
const router = express.Router();
const { User, NGO, Donation } = require('./models');

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
    res.json({
      users: totalUsers,
      donations: totalDonations,
      tokens: totalTokens[0]?.sum || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
