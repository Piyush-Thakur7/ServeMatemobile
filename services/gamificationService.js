const LEVELS = [
  { minLevel: 1, maxLevel: 4, title: "Beginner", icon: "\u{1F331}", rarity: "common", gradient: "linear-gradient(135deg,#22c55e,#84cc16)" },
  { minLevel: 5, maxLevel: 9, title: "Contributor", icon: "\u26A1", rarity: "uncommon", gradient: "linear-gradient(135deg,#0ea5e9,#2563eb)" },
  { minLevel: 10, maxLevel: 14, title: "Gold Supporter", icon: "\u{1F947}", rarity: "rare", gradient: "linear-gradient(135deg,#f59e0b,#facc15)" },
  { minLevel: 15, maxLevel: 19, title: "Platinum Ace", icon: "\u{1F48E}", rarity: "epic", gradient: "linear-gradient(135deg,#06b6d4,#8b5cf6)" },
  { minLevel: 20, maxLevel: 29, title: "Impact Creator", icon: "\u{1F525}", rarity: "mythic", gradient: "linear-gradient(135deg,#ef4444,#f97316)" },
  { minLevel: 30, maxLevel: 39, title: "Community Hero", icon: "\u{1F451}", rarity: "heroic", gradient: "linear-gradient(135deg,#a855f7,#ec4899)" },
  { minLevel: 40, maxLevel: 49, title: "Elite Supporter", icon: "\u{1F680}", rarity: "elite", gradient: "linear-gradient(135deg,#14b8a6,#3b82f6)" },
  { minLevel: 50, maxLevel: Infinity, title: "Legendary Guardian", icon: "\u{1F6E1}\uFE0F", rarity: "legendary", gradient: "linear-gradient(135deg,#111827,#6366f1)" },
];

function getLevelFromXp(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  return Math.max(1, Math.floor(Math.sqrt(safeXp / 100)) + 1);
}

function getXpForLevel(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return Math.pow(safeLevel - 1, 2) * 100;
}

function getRankForLevel(level = 1) {
  return LEVELS.find((rank) => level >= rank.minLevel && level <= rank.maxLevel) || LEVELS[0];
}

function getProgression(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = getLevelFromXp(safeXp);
  const currentLevelXp = getXpForLevel(level);
  const nextLevelXp = getXpForLevel(level + 1);
  const xpIntoLevel = safeXp - currentLevelXp;
  const xpForNextLevel = nextLevelXp - currentLevelXp;
  const progress = xpForNextLevel > 0
    ? Math.min(100, Math.round((xpIntoLevel / xpForNextLevel) * 100))
    : 100;
  const rank = getRankForLevel(level);

  return {
    xp: safeXp,
    level,
    title: rank.title,
    titleIcon: rank.icon,
    titleGradient: rank.gradient,
    titleRarity: rank.rarity,
    currentLevelXp,
    nextLevelXp,
    xpRequiredForNextLevel: nextLevelXp,
    xpIntoLevel,
    xpForNextLevel,
    xpRemaining: Math.max(0, nextLevelXp - safeXp),
    progress,
    ranks: LEVELS,
  };
}

function applyProgression(user) {
  const progression = getProgression(user.xp);
  user.level = progression.level;
  user.title = progression.title;
  return progression;
}

module.exports = {
  LEVELS,
  applyProgression,
  getLevelFromXp,
  getProgression,
  getRankForLevel,
  getXpForLevel,
};
