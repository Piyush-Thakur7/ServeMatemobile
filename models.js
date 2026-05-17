const mongoose = require("mongoose");
const { applyProgression } = require("./services/gamificationService");

// ─── USER ───────────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true },
  role:         { type: String, enum: ["user", "ngo", "admin"], default: "user" },
  avatar:       { type: String, default: "" },
  bio:          { type: String, default: "", maxlength: 500 },
  // Gamification
  xp:           { type: Number, default: 0 },
  level:        { type: Number, default: 1 },
  title:        { type: String, default: "Beginner" },
  badges:       [{ type: String }],
  joinedNgos:   [{ type: mongoose.Schema.Types.ObjectId, ref: "NGO" }],
  volunteerActivity: [{
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
    status: { type: String, enum: ["requested", "approved", "rejected"], default: "requested" },
    title: { type: String, default: "Volunteer" },
    createdAt: { type: Date, default: Date.now },
  }],
  // Stats
  totalDonated: { type: Number, default: 0 },
  donationCount:{ type: Number, default: 0 },
  // Streak
  lastDonation: { type: Date },
  streak:       { type: Number, default: 0 },
}, { timestamps: true });

// Auto-set level based on XP
userSchema.pre("save", function (next) {
  applyProgression(this);
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
  about:          { type: String, default: "" },
  banner:         { type: String, default: "" },
  logo:           { type: String, default: "" },
  location:      { type: String, default: "" },
  contact: {
    phone: { type: String, default: "" },
    website: { type: String, default: "" },
    instagram: { type: String, default: "" },
    x: { type: String, default: "" },
    facebook: { type: String, default: "" },
  },
  volunteerCount:{ type: Number, default: 0 },
  volunteers:    [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    email: String,
    phone: String,
    status: { type: String, enum: ["requested", "approved", "rejected"], default: "requested" },
    title: { type: String, default: "Volunteer" },
    requestedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
  }],
  updates: [{
    title: String,
    note: String,
    proofUrl: String,
    createdAt: { type: Date, default: Date.now },
  }],
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
  icon:         { type: String, default: "SM" },
  category:     { type: String, enum: ["meals","trees","essentials","ngo-support","education","health","other"], required: true },
  goal:         { type: Number, required: true },
  raised:       { type: Number, default: 0 },
  impactPerRupee:{ type: String, default: "Rs 10 = 1 impact unit" },
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
