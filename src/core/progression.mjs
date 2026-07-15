import { getAchievementInstanceId } from "./achievements.mjs";

const EXP_CURVE_FACTOR = 16;

export function getLevelFromExp(exp) {
  const safeExp = sanitizeNonNegativeFiniteNumber(exp);
  const value = Math.max(1, Math.floor(Math.sqrt(safeExp / EXP_CURVE_FACTOR)) + 1);
  const currentLevelExp = value === 1 ? 0 : getRequiredExpForLevel(value);
  const nextLevelExp = getRequiredExpForLevel(value + 1);
  const levelSpan = nextLevelExp - currentLevelExp;

  return {
    value,
    exp: safeExp,
    nextLevelExp,
    progress: levelSpan > 0 ? Math.min(0.99, (safeExp - currentLevelExp) / levelSpan) : 0,
  };
}

export function getRequiredExpForLevel(level) {
  const numericLevel = Number(level);
  const safeLevel = Number.isFinite(numericLevel) ? Math.max(2, numericLevel) : 2;
  return Math.round(Math.pow(safeLevel - 1, 2) * EXP_CURVE_FACTOR);
}

export function applyExp(currentLevel, gainedExp) {
  const nextExp = sanitizeNonNegativeFiniteNumber(currentLevel?.exp) + sanitizeNonNegativeFiniteNumber(gainedExp);
  return getLevelFromExp(nextExp);
}

export function grantDailyExp(save, reward) {
  if (!reward?.key) {
    return save;
  }

  const ledger = Array.isArray(save?.rewardLedger) ? save.rewardLedger : [];

  if (ledger.some((entry) => entry?.key === reward.key)) {
    return save;
  }

  const entry = {
    key: reward.key,
    type: reward.type,
    exp: Math.max(0, Math.round(Number(reward.exp) || 0)),
    at: reward.at,
  };

  return {
    ...save,
    rewardLedger: [...ledger, entry],
    level: applyExp(save?.level, entry.exp),
  };
}

export function getRarity(seed, min = 3.2, max = 64.8) {
  let hash = 0;

  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const ratio = hash / 0xffffffff;
  return Number((min + ratio * (max - min)).toFixed(1));
}

export function unlockRuntimeAchievements(save, now = new Date().toISOString()) {
  const taskHistory = asArray(save?.taskHistory);
  const completedNpcTasks = taskHistory.filter((task) => (
    task?.category === "npc_noise_reduction" && task?.completed
  )).length;

  if (completedNpcTasks < 3) {
    return save;
  }

  const achievements = asArray(save?.achievements);
  const titles = asArray(save?.titles);
  const tags = asArray(save?.tags);
  const hasNpcFilterAchievement = achievements.some(
    (achievement) => getAchievementInstanceId(achievement) === "npc_filter",
  );
  const nextAchievements = hasNpcFilterAchievement
    ? achievements
    : [
      ...achievements,
      {
        achievementId: "npc_filter",
        label: "拒绝无效消耗",
        rarityPercent: getRarity("npc_filter", 4.0, 12.0),
        source: "runtime",
        unlockedAt: now,
        hidden: false,
        displayable: true,
        spotlightAllowed: true,
      },
    ];
  const nextTitles = appendUnique(titles, "NPC过滤器");
  const nextTags = appendUnique(tags, "NPC过滤器");

  if (nextAchievements === achievements && nextTitles === titles && nextTags === tags) {
    return save;
  }

  return {
    ...save,
    achievements: nextAchievements,
    titles: nextTitles,
    tags: nextTags,
  };
}

function sanitizeNonNegativeFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}

function appendUnique(values, value) {
  return values.includes(value) ? values : [...values, value];
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
