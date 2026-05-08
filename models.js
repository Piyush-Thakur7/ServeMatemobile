const mongoose = require("mongoose");

// ─── USER ───────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  role:         { type: String, enum: ["user", "ngo", "admin"], default: "user" },
  avatar:       { type: String, default: "" },
  // Gamification
  xp:           { type: Number, default: 0 },
  level:        { type: String, default: "Beginner" },
  badges:       [{ type: String }],
  // Stats
  totalDonated: { type: Number, default: 0 },
  donationCount:{ type: Number, default: 0 },
  // Streak
  lastDonation: { type: Date },
  streak:       { type: Number, default: 0 },
}, { timestamps: true });

// Auto-set level based on XP
userSchema.pre("save", function (next) {
  const xp = this.xp;
  if      (xp >= 5000) this.level = "Impact Creator";
  else if (xp >= 2000) this.level = "Active Supporter";
  else if (xp >= 500)  this.level = "Contributor";
  else                 this.level = "Beginner";
  next();
});

// ─── NGO ────────────────────────────────────────────────────────────────────
const ngoSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  email:         { type: String, required: true, unique: true, lowercase: true },
  password:      { type: String, required: true },
  regNumber:     { type: String, required: true },
  taxStatus:     { type: String, enum: ["12A", "80G", "Both"], required: true },
  areaOfWork:    { type: String, required: true },
  description:   { type: String, default: "" },
  location:      { type: String, default: "" },
  volunteerCount:{ type: Number, default: 0 },
  volunteers:    [{ name: String, email: String, phone: String }],
  // Platform status
  verified:      { type: Boolean, default: false },
  verifiedAt:    { type: Date },
  rank:          { type: Number, default: 0 },
  rating:        { type: Number, default: 0 },
  ratingCount:   { type: Number, default: 0 },
  impactScore:   { type: Number, default: 0 },
  tasksCompleted:{ type: Number, default: 0 },
  onTimeRate:    { type: Number, default: 100 },
  totalReceived: { type: Number, default: 0 },
}, { timestamps: true });

// ─── CAUSE ───────────────────────────────────────────────────────────────────
const causeSchema = new mongoose.Schema({
  title:        { type: String, required: true },
  description:  { type: String, required: true },
  icon:         { type: String, default: "🌟" },
  category:     { type: String, enum: ["meals","trees","essentials","education","health","other"], required: true },
  goal:         { type: Number, required: true },
  raised:       { type: Number, default: 0 },
  impactPerRupee:{ type: String, default: "₹10 = 1 impact unit" },
  active:       { type: Boolean, default: true },
  assignedNgo:  { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
  contributors: { type: Number, default: 0 },
}, { timestamps: true });

// ─── DONATION ────────────────────────────────────────────────────────────────
const donationSchema = new mongoose.Schema({
  user:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cause:      { type: mongoose.Schema.Types.ObjectId, ref: "Cause", required: true },
  ngo:        { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
  amount:     { type: Number, required: true, min: 10 },
  xpEarned:  { type: Number, default: 0 },
  status:     { type: String, enum: ["pending","assigned","completed","verified"], default: "pending" },
  proofVideo: { type: String, default: "" },   // YouTube URL
  proofNote:  { type: String, default: "" },
  location:   { type: String, default: "" },
  verifiedAt: { type: Date },
}, { timestamps: true });

// ─── TRANSPARENCY LOG ────────────────────────────────────────────────────────
const transparencySchema = new mongoose.Schema({
  donation:    { type: mongoose.Schema.Types.ObjectId, ref: "Donation" },
  ngo:         { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
  cause:       { type: mongoose.Schema.Types.ObjectId, ref: "Cause" },
  description: { type: String, required: true },
  proofVideo:  { type: String, default: "" },
  location:    { type: String, default: "" },
  date:        { type: Date, default: Date.now },
  amount:      { type: Number },
}, { timestamps: true });

// ─── CONTACT MESSAGE ─────────────────────────────────────────────────────────
const contactSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  email:   { type: String, required: true },
  message: { type: String, required: true },
  read:    { type: Boolean, default: false },
}, { timestamps: true });

module.exports = {
  User:         mongoose.model("User", userSchema),
  NGO:          mongoose.model("NGO", ngoSchema),
  Cause:        mongoose.model("Cause", causeSchema),
  Donation:     mongoose.model("Donation", donationSchema),
  Transparency: mongoose.model("Transparency", transparencySchema),
  Contact:      mongoose.model("Contact", contactSchema),
};
