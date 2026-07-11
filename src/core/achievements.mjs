export function createEmptyAchievementArchive() {
  return {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
  };
}

export function getAchievementInstanceId(instance) {
  if (!isRecord(instance)) {
    return "";
  }

  return normalizeId(instance.achievementId) || normalizeId(instance.id);
}

export function normalizeAchievementArchive(value) {
  const defaults = createEmptyAchievementArchive();
  const archive = isRecord(value) ? value : {};

  return {
    ...defaults,
    ...archive,
    version: isPositiveInteger(archive.version) ? archive.version : defaults.version,
    scanStatus: normalizeScanStatus(archive.scanStatus),
    candidateIds: normalizeIds(archive.candidateIds),
    dismissedIds: normalizeIds(archive.dismissedIds),
    firstNightEnteredAt: normalizeNullableString(archive.firstNightEnteredAt),
    lastSwitchDate: normalizeNullableString(archive.lastSwitchDate),
    switchCount: isNonnegativeInteger(archive.switchCount)
      ? archive.switchCount
      : defaults.switchCount,
    lastRecovery: isPlainObject(archive.lastRecovery)
      ? { ...archive.lastRecovery }
      : defaults.lastRecovery,
  };
}

function normalizeScanStatus(value) {
  return value === "review" || value === "complete" ? value : "pending";
}

function normalizeNullableString(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeId).filter(Boolean))];
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isPlainObject(value) {
  if (!isRecord(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
