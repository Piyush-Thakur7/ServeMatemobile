const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { User } = require("./models");

const ADMIN_EMAIL = "th.piyushsingh2007@gmail.com";

let jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  jwtSecret = crypto.randomBytes(32).toString("hex");
  console.warn("[auth] JWT_SECRET is not set. Using an in-memory fallback; set JWT_SECRET in production.");
}

function signToken(user) {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    jwtSecret,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );
}

async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = jwt.verify(auth.slice(7), jwtSecret);
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

async function adminOnly(req, res, next) {
  return authMiddleware(req, res, async () => {
    try {
      if (req.user.role !== "admin" || req.user.email !== ADMIN_EMAIL) {
        return res.status(403).json({ error: "Admin access required" });
      }

      const admin = await User.findOne({
        _id: req.user.id,
        email: ADMIN_EMAIL,
        role: "admin",
      }).select("_id email role");

      if (!admin) {
        return res.status(403).json({ error: "Admin access required" });
      }

      req.admin = admin;
      return next();
    } catch (err) {
      console.error("[auth] Admin verification failed:", err.message);
      return res.status(500).json({ error: "Admin verification failed" });
    }
  });
}

module.exports = {
  ADMIN_EMAIL,
  signToken,
  authMiddleware,
  adminOnly,
};
