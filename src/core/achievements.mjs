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
    candidateIds: normalizeIds(archive.candidateIds),
    dismissedIds: normalizeIds(archive.dismissedIds),
  };
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

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
