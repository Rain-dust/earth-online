import {
  ACHIEVEMENT_CATALOG,
  getAchievementDefinition,
} from "./achievement-catalog.mjs";

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

export function getOldSaveCandidateIds(answers = {}) {
  const source = isRecord(answers) ? answers : {};
  const signals = new Set();

  if (["undergraduate", "graduate"].includes(source.educationStage)) {
    signals.add(`education_${source.educationStage}`);
  }
  if (["working", "freelancing"].includes(source.currentStage)) {
    signals.add(`stage_${source.currentStage}`);
  }
  if (["recovered", "repeated_recovery"].includes(source.setbackRecovery)) {
    signals.add(`setback_${source.setbackRecovery}`);
  }

  return ACHIEVEMENT_CATALOG
    .filter((definition) => definition.oldSaveSignals.some((signal) => signals.has(signal)))
    .map((definition) => definition.id);
}

export function confirmOldSaveAchievement(save, id, now = new Date().toISOString()) {
  const definition = getAchievementDefinition(normalizeId(id));
  if (!definition) {
    return save;
  }

  const achievements = getAchievements(save);
  const alreadyConfirmed = achievements.some(
    (instance) => getAchievementInstanceId(instance) === definition.id,
  );
  const archive = normalizeAchievementArchive(save?.achievementArchive);

  return {
    ...save,
    achievements: alreadyConfirmed
      ? achievements
      : [
          ...achievements,
          {
            achievementId: definition.id,
            unlockedAt: now,
            source: "old_save_confirmed",
            hidden: false,
            displayable: true,
            spotlightAllowed: true,
          },
        ],
    achievementArchive: {
      ...archive,
      dismissedIds: archive.dismissedIds.filter((dismissedId) => dismissedId !== definition.id),
    },
  };
}

export function dismissOldSaveAchievement(save, id) {
  const definition = getAchievementDefinition(normalizeId(id));
  if (!definition) {
    return save;
  }

  const archive = normalizeAchievementArchive(save?.achievementArchive);
  return {
    ...save,
    achievementArchive: {
      ...archive,
      dismissedIds: [...new Set([...archive.dismissedIds, definition.id])],
    },
  };
}

export function restoreDismissedOldSaveAchievement(save, id) {
  const definition = getAchievementDefinition(normalizeId(id));
  if (!definition) {
    return save;
  }

  const archive = normalizeAchievementArchive(save?.achievementArchive);
  return {
    ...save,
    achievementArchive: {
      ...archive,
      dismissedIds: archive.dismissedIds.filter((dismissedId) => dismissedId !== definition.id),
    },
  };
}

export function revokeOldSaveAchievement(save, id) {
  const definition = getAchievementDefinition(normalizeId(id));
  if (!definition) {
    return save;
  }

  const archive = normalizeAchievementArchive(save?.achievementArchive);
  return {
    ...save,
    achievements: getAchievements(save).filter(
      (instance) =>
        getAchievementInstanceId(instance) !== definition.id ||
        instance.source !== "old_save_confirmed",
    ),
    achievementArchive: {
      ...archive,
      candidateIds: [...new Set([...archive.candidateIds, definition.id])],
      dismissedIds: archive.dismissedIds.filter((dismissedId) => dismissedId !== definition.id),
    },
  };
}

export function setAchievementPresentation(save, id, patch) {
  const instanceId = normalizeId(id);
  const achievements = getAchievements(save);
  if (!instanceId || !achievements.some((instance) => getAchievementInstanceId(instance) === instanceId)) {
    return save;
  }

  const presentationPatch = {};
  for (const field of ["hidden", "displayable", "spotlightAllowed"]) {
    if (typeof patch?.[field] === "boolean") {
      presentationPatch[field] = patch[field];
    }
  }
  if (Object.keys(presentationPatch).length === 0) {
    return save;
  }

  return {
    ...save,
    achievements: achievements.map((instance) =>
      getAchievementInstanceId(instance) === instanceId
        ? { ...instance, ...presentationPatch }
        : instance,
    ),
  };
}

export function completeOldSaveReview(save, now = new Date().toISOString()) {
  const catalogOrder = new Map(
    ACHIEVEMENT_CATALOG.map((definition, index) => [definition.id, index]),
  );
  const confirmedById = new Map();
  for (const instance of getAchievements(save)) {
    if (!isRecord(instance) || instance.source !== "old_save_confirmed") {
      continue;
    }

    const definition = getAchievementDefinition(getAchievementInstanceId(instance));
    if (!definition) {
      continue;
    }

    const existing = confirmedById.get(definition.id);
    confirmedById.set(definition.id, {
      definition,
      privacyRestricted:
        existing?.privacyRestricted === true ||
        instance.hidden === true ||
        instance.spotlightAllowed === false,
    });
  }
  const confirmed = [...confirmedById.values()];
  const representative = confirmed
    .filter(({ privacyRestricted }) => !privacyRestricted)
    .sort(
      (left, right) =>
        left.definition.rarityPercent - right.definition.rarityPercent ||
        catalogOrder.get(left.definition.id) - catalogOrder.get(right.definition.id),
    )[0];
  const archive = normalizeAchievementArchive(save?.achievementArchive);

  return {
    ...save,
    achievementArchive: {
      ...archive,
      scanStatus: "complete",
      lastRecovery: {
        at: now,
        count: confirmed.length,
        representativeId: representative?.definition.id || null,
        remainingCount: confirmed.length - (representative ? 1 : 0),
      },
    },
  };
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
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map(normalizeId).filter(Boolean))];
}

function getAchievements(save) {
  return Array.isArray(save?.achievements) ? save.achievements : [];
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
