const mongoose = require("mongoose");

const ADMIN_EMAIL = "th.piyushsingh2007@gmail.com";

const levelTiers = [
  { minXp: 0, level: 1, title: "Beginner" },
  { minXp: 250, level: 2, title: "Contributor" },
  { minXp: 1000, level: 3, title: "Impact Creator" },
  { minXp: 2500, level: 4, title: "Community Hero" },
  { minXp: 5000, level: 5, title: "Elite Supporter" },
  { minXp: 10000, level: 6, title: "Legacy Builder" },
];

function progressionForXp(xp = 0) {
  const current = [...levelTiers].reverse().find((tier) => xp >= tier.minXp) || levelTiers[0];
  const next = levelTiers.find((tier) => tier.minXp > xp) || null;
  return {
    level: current.level,
    title: current.title,
    currentLevelXp: current.minXp,
    nextLevelXp: next ? next.minXp : null,
    xpToNextLevel: next ? Math.max(next.minXp - xp, 0) : 0,
    xpProgress: next
      ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100)
      : 100,
  };
}

const achievementCatalog = [
  { key: "first_login", name: "First Step", description: "Signed in to ServeMATE." },
  { key: "daily_login", name: "Daily Spark", description: "Returned on a new day." },
  { key: "first_token_purchase", name: "First Token Pack", description: "Purchased platform tokens." },
  { key: "supporter_100", name: "100 Token Supporter", description: "Purchased at least 100 tokens." },
  { key: "supporter_500", name: "500 Token Supporter", description: "Purchased at least 500 tokens." },
  { key: "impact_1000", name: "Impact 1000", description: "Reached 1000 impact score." },
];

const badgeCatalog = [
  { key: "first-token-pack", name: "First Token Pack", description: "Purchased tokens for the first time." },
  { key: "consistent-supporter", name: "Consistent Supporter", description: "Purchased at least 500 tokens." },
  { key: "impact-creator", name: "Impact Creator", description: "Reached 1000 XP." },
  { key: "community-hero", name: "Community Hero", description: "Reached 2500 XP." },
  { key: "elite-supporter", name: "Elite Supporter", description: "Reached 5000 XP." },
];

const achievementSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    unlockedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, trim: true, lowercase: true, sparse: true, unique: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "ngo", "admin"], default: "user" },
    xp: { type: Number, default: 0, min: 0 },
    level: { type: Number, default: 1, min: 1 },
    title: { type: String, default: "Beginner" },
    badges: [{ type: String }],
    tokenBalance: { type: Number, default: 0, min: 0 },
    totalTokensPurchased: { type: Number, default: 0, min: 0 },
    totalImpact: { type: Number, default: 0, min: 0 },
    profileImage: { type: String, default: "" },
    bio: { type: String, default: "", maxlength: 500 },
    achievements: [achievementSchema],
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
    lastDailyXpAt: { type: Date },

    avatar: { type: String, default: "" },
    totalDonated: { type: Number, default: 0 },
    donationCount: { type: Number, default: 0 },
    lastDonation: { type: Date },
    streak: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.pre("validate", function setAdminAndProgression() {
  if (this.email === ADMIN_EMAIL) this.role = "admin";
  const progression = progressionForXp(this.xp);
  this.level = progression.level;
  this.title = progression.title;
});

userSchema.methods.addAchievement = function addAchievement(key) {
  if (this.achievements.some((achievement) => achievement.key === key)) return;
  const catalogItem = achievementCatalog.find((achievement) => achievement.key === key);
  if (catalogItem) {
    this.achievements.push(catalogItem);
  }
};

userSchema.methods.recalculateGamification = function recalculateGamification() {
  const badges = new Set(this.badges || []);
  if (this.totalTokensPurchased > 0) {
    badges.add("First Token Pack");
    this.addAchievement("first_token_purchase");
  }
  if (this.totalTokensPurchased >= 100) this.addAchievement("supporter_100");
  if (this.totalTokensPurchased >= 500) {
    badges.add("Consistent Supporter");
    this.addAchievement("supporter_500");
  }
  if (this.xp >= 1000) badges.add("Impact Creator");
  if (this.xp >= 2500) badges.add("Community Hero");
  if (this.xp >= 5000) badges.add("Elite Supporter");
  if (this.totalImpact >= 1000) this.addAchievement("impact_1000");
  this.badges = Array.from(badges);
};

const tokenTransactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currencyAmount: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: "INR" },
    type: {
      type: String,
      enum: ["purchase", "contribution", "admin_adjustment", "refund"],
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["created", "pending", "success", "failed", "refunded"],
      default: "pending",
      index: true,
    },
    provider: { type: String, enum: ["razorpay", "manual", "system"], default: "manual" },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String },
    providerSignature: { type: String },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const ngoSchema = new mongoose.Schema(
  {
    ngoName: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    founderName: { type: String, default: "" },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    location: { type: String, default: "" },
    documents: [{ type: String }],
    verified: { type: Boolean, default: false },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    impactScore: { type: Number, default: 0, min: 0 },
    volunteers: [{ name: String, email: String, phone: String }],
    createdAt: { type: Date, default: Date.now },
    verifiedAt: { type: Date },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectionReason: { type: String, default: "" },

    name: { type: String, trim: true },
    password: { type: String },
    regNumber: { type: String },
    taxStatus: { type: String },
    areaOfWork: { type: String },
    volunteerCount: { type: Number, default: 0 },
    tasksCompleted: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    onTimeRate: { type: Number, default: 100 },
    totalReceived: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ngoSchema.pre("validate", function normalizeNgo() {
  if (!this.ngoName && this.name) this.ngoName = this.name;
  if (!this.name && this.ngoName) this.name = this.ngoName;
  if (this.approvalStatus === "approved") this.verified = true;
  if (this.verified && this.approvalStatus === "pending") this.approvalStatus = "approved";
});

const contactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, default: "ServeMATE contact" },
    message: { type: String, required: true, trim: true },
    ipHash: { type: String, default: "" },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const activitySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      enum: ["login", "daily_login", "token_purchase", "token_contribution", "achievement", "admin"],
      required: true,
    },
    message: { type: String, required: true },
    xp: { type: Number, default: 0 },
    tokens: { type: Number, default: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

const badgeSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    audience: { type: String, enum: ["all", "users", "ngos"], default: "all" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const causeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String, default: "impact" },
    category: { type: String, enum: ["meals", "trees", "essentials", "education", "health", "other"], required: true },
    goal: { type: Number, default: 0 },
    raised: { type: Number, default: 0 },
    impactPerRupee: { type: String, default: "Tokens create virtual support points" },
    active: { type: Boolean, default: true },
    assignedNgo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
    contributors: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const donationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    cause: { type: mongoose.Schema.Types.ObjectId, ref: "Cause" },
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
    amount: { type: Number, required: true, min: 1 },
    xpEarned: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "assigned", "completed", "verified"], default: "pending" },
    proofVideo: { type: String, default: "" },
    proofNote: { type: String, default: "" },
    location: { type: String, default: "" },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

const transparencySchema = new mongoose.Schema(
  {
    donation: { type: mongoose.Schema.Types.ObjectId, ref: "Donation" },
    ngo: { type: mongoose.Schema.Types.ObjectId, ref: "NGO" },
    cause: { type: mongoose.Schema.Types.ObjectId, ref: "Cause" },
    description: { type: String, required: true },
    proofVideo: { type: String, default: "" },
    location: { type: String, default: "" },
    date: { type: Date, default: Date.now },
    amount: { type: Number },
  },
  { timestamps: true }
);

module.exports = {
  ADMIN_EMAIL,
  levelTiers,
  badgeCatalog,
  achievementCatalog,
  progressionForXp,
  User: mongoose.model("User", userSchema),
  TokenTransaction: mongoose.model("TokenTransaction", tokenTransactionSchema),
  NGO: mongoose.model("NGO", ngoSchema),
  Contact: mongoose.model("Contact", contactSchema),
  Activity: mongoose.model("Activity", activitySchema),
  Badge: mongoose.model("Badge", badgeSchema),
  Announcement: mongoose.model("Announcement", announcementSchema),
  Cause: mongoose.model("Cause", causeSchema),
  Donation: mongoose.model("Donation", donationSchema),
  Transparency: mongoose.model("Transparency", transparencySchema),
};


