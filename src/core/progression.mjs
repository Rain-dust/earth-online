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

export function getRarity(seed, min = 3.2, max = 64.8) {
  let hash = 0;

  for (const char of String(seed)) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const ratio = hash / 0xffffffff;
  return Number((min + ratio * (max - min)).toFixed(1));
}

function sanitizeNonNegativeFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? Math.max(0, numericValue) : 0;
}
