const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  city: { type: String },
  xp: { type: Number, default: 0 },
  tokens: { type: Number, default: 100 }, // New: Token balance for prototype
  totalDonated: { type: Number, default: 0 },
  level: { type: String, default: 'Beginner' },
  badges: [String],
  role: { type: String, enum: ['user', 'admin'], default: 'user' }, // New: Role for Admin Panel
  joinedAt: { type: Date, default: Date.now }
});

const ngoSchema = new mongoose.Schema({
  name: { type: String, required: true },
  regNumber: { type: String, required: true, unique: true },
  location: { type: String },
  rating: { type: Number, default: 0 },
  reviewsCount: { type: Number, default: 0 },
  motive: { type: String },
  isVerified: { type: Boolean, default: false },
  tasksCompleted: { type: Number, default: 0 },
  volunteers: [{ name: String, initials: String }],
  impactScore: { type: Number, default: 0 }
});

const donationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'NGO' },
  amount: { type: Number, required: true },
  cause: { type: String, required: true },
  status: { type: String, enum: ['Pending', 'Verified'], default: 'Pending' },
  proofUrl: { type: String },
  date: { type: Date, default: Date.now }
});

const taskSchema = new mongoose.Schema({
  ngoId: { type: mongoose.Schema.Types.ObjectId, ref: 'NGO', required: true },
  title: { type: String, required: true },
  description: { type: String },
  impactAmount: { type: Number },
  proofUrl: { type: String },
  date: { type: Date, default: Date.now },
  isVerified: { type: Boolean, default: false }
});

module.exports = {
  User: mongoose.model('User', userSchema),
  NGO: mongoose.model('NGO', ngoSchema),
  Donation: mongoose.model('Donation', donationSchema),
  Task: mongoose.model('Task', taskSchema)
};
