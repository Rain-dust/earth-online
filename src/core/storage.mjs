import {
  createEmptyAchievementArchive,
  normalizeAchievementArchive,
} from "./achievements.mjs";
import {
  createEmptyOnboarding,
  normalizeOnboarding,
} from "./player-profile.mjs";
import { normalizePlayerLocation } from "./player-location.mjs";
import {
  createInitialPlayerRuntime,
  normalizePlayerRuntime,
} from "./player-runtime.mjs";

export const SAVE_FORMAT = "earth-online-save-v1";
export const STORAGE_KEY = "earth-online-save-v1";
export const SCHEMA_VERSION = 4;

export function createEmptySave(exportedAt = new Date().toISOString()) {
  return {
    format: SAVE_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    systemNote: "旧存档仍在运行",
    profile: null,
    onboarding: createEmptyOnboarding(),
    connection: {
      firstConnectedAt: null,
      lastActiveAt: null,
      lastBroadcastAt: null,
    },
    level: { value: 1, exp: 0, nextLevelExp: 100 },
    currentStatus: null,
    statusHistory: [],
    playerRuntime: createInitialPlayerRuntime(),
    dailyTasks: [],
    taskHistory: [],
    achievements: [],
    achievementArchive: createEmptyAchievementArchive(),
    titles: [],
    tags: [],
    realLifeAchievements: [],
    correctionLog: [],
    customTaskPool: [],
    mainQuest: null,
    mainQuestArchive: [],
    dailyRuns: [],
    activityEvents: [],
    rewardLedger: [],
    weeklyArchive: [],
    maintenancePreferences: {
      excludedIds: [],
      customItems: [],
    },
    settings: {
      fixedTags: [],
      hiddenTags: [],
      selectedTitle: null,
    },
  };
}

export function exportSave(save) {
  return `${JSON.stringify(normalizeSaveForExport(save), null, 2)}\n`;
}

export function downloadSaveJson(save, documentRef = document) {
  const exportedSave = {
    ...save,
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([exportSave(exportedSave)], { type: "application/json" });
  const urlApi = documentRef?.defaultView?.URL || globalThis.URL;
  const objectUrl = urlApi.createObjectURL(blob);
  const anchor = documentRef.createElement("a");

  anchor.href = objectUrl;
  anchor.download = `earth-online-save-${exportedSave.exportedAt.slice(0, 10)}.json`;

  try {
    documentRef.body?.appendChild?.(anchor);
    anchor.click();
  } finally {
    anchor.remove?.();
    urlApi.revokeObjectURL(objectUrl);
  }
}

export async function readSaveFile(file) {
  if (!file) {
    throw new Error("No save file selected");
  }

  return file.text();
}

export function importSave(json, currentSave = createEmptySave()) {
  let parsed;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error("Save JSON is not valid");
  }

  if (parsed.format !== SAVE_FORMAT) {
    throw new Error("Unsupported save format");
  }

  return mergeWithDefaults(parsed, currentSave);
}

export function loadLocalSave(storage) {
  const resolvedStorage = storage === undefined ? getDefaultStorage() : storage;

  if (!resolvedStorage) {
    return createEmptySave();
  }

  const raw = resolvedStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptySave();
  }

  return importSave(raw);
}

export function readLocalSaveSnapshot(storage) {
  let resolvedStorage;

  try {
    resolvedStorage = storage === undefined ? globalThis.localStorage : storage;
  } catch (error) {
    return createReadError(error);
  }

  if (!resolvedStorage) {
    return createReadError(new Error("Local storage is unavailable"));
  }

  try {
    const raw = resolvedStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { status: "empty", save: createEmptySave(), error: null };
    }

    return { status: "found", save: importSave(raw), error: null };
  } catch (error) {
    return createReadError(error);
  }
}

export function saveLocalSave(save, storage) {
  const resolvedStorage = storage === undefined ? getDefaultStorage() : storage;

  if (!resolvedStorage) {
    return save;
  }

  resolvedStorage.setItem(STORAGE_KEY, exportSave(save));
  return save;
}

function normalizeSaveForExport(save) {
  return mergeWithDefaults(save, createEmptySave(save.exportedAt));
}

function getDefaultStorage() {
  try {
    return globalThis.localStorage;
  } catch (error) {
    return null;
  }
}

function mergeWithDefaults(save, defaults) {
  return {
    ...defaults,
    ...save,
    schemaVersion: SCHEMA_VERSION,
    profile: normalizeProfile(save.profile),
    onboarding: normalizeOnboarding(save.onboarding, {
      hasProfile: Boolean(save.profile && typeof save.profile === "object"),
    }),
    connection: normalizeConnection(save.connection, defaults.connection),
    playerRuntime: normalizePlayerRuntime(save.playerRuntime),
    level: { ...defaults.level, ...(save.level || {}) },
    settings: { ...defaults.settings, ...(save.settings || {}) },
    mainQuest: normalizeMainQuest(save.mainQuest, save.exportedAt || defaults.exportedAt),
    mainQuestArchive: normalizeArray(save.mainQuestArchive, defaults.mainQuestArchive),
    dailyRuns: normalizeArray(save.dailyRuns, defaults.dailyRuns),
    activityEvents: normalizeArray(save.activityEvents, defaults.activityEvents),
    rewardLedger: normalizeArray(save.rewardLedger, defaults.rewardLedger),
    weeklyArchive: normalizeArray(save.weeklyArchive, defaults.weeklyArchive),
    maintenancePreferences: normalizeMaintenancePreferences(
      save.maintenancePreferences,
      defaults.maintenancePreferences,
    ),
    dailyTasks: Array.isArray(save.dailyTasks) ? save.dailyTasks : defaults.dailyTasks,
    taskHistory: Array.isArray(save.taskHistory) ? save.taskHistory : defaults.taskHistory,
    achievements: Array.isArray(save.achievements) ? save.achievements : defaults.achievements,
    achievementArchive: normalizeAchievementArchive(save.achievementArchive),
    titles: Array.isArray(save.titles) ? save.titles : defaults.titles,
    tags: Array.isArray(save.tags) ? save.tags : defaults.tags,
    correctionLog: Array.isArray(save.correctionLog) ? save.correctionLog : defaults.correctionLog,
    customTaskPool: Array.isArray(save.customTaskPool) ? save.customTaskPool : defaults.customTaskPool,
  };
}

function normalizeProfile(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const { location, ...profile } = value;
  const normalized = normalizePlayerLocation(value);
  profile.locationSetupStatus = normalized.locationSetupStatus;
  if (normalized.location) profile.location = normalized.location;
  return profile;
}

function createReadError(error) {
  return {
    status: "error",
    save: null,
    error: error instanceof Error ? error : new Error(String(error || "Local save read failed")),
  };
}

function normalizeConnection(value, defaults) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};

  return {
    ...defaults,
    ...source,
    firstConnectedAt: normalizeOptionalTimestamp(source.firstConnectedAt),
    lastActiveAt: normalizeOptionalTimestamp(source.lastActiveAt),
    lastBroadcastAt: normalizeOptionalTimestamp(source.lastBroadcastAt),
  };
}

function normalizeOptionalTimestamp(value) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeMainQuest(value, exportedAt) {
  if (!value) {
    return null;
  }

  const source = typeof value === "object" ? value : {};
  const title = typeof value === "string"
    ? value.trim()
    : String(source.title || "").trim();

  if (!title) {
    return null;
  }

  const currentAction = source.currentAction && typeof source.currentAction === "object"
    ? source.currentAction
    : {};
  const actionText = String(currentAction.text || source.nextStep || title).trim();

  return {
    ...source,
    id: source.id || "legacy-main-quest",
    title,
    status: "active",
    startedAt: source.startedAt || exportedAt,
    currentAction: {
      ...currentAction,
      id: currentAction.id || "legacy-main-action",
      text: actionText,
      createdAt: currentAction.createdAt || exportedAt,
    },
  };
}

function normalizeMaintenancePreferences(value, defaults) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    ...defaults,
    ...source,
    excludedIds: normalizeStringArray(source.excludedIds),
    customItems: normalizeArray(source.customItems, defaults.customItems),
  };
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean))];
}

function normalizeArray(value, fallback) {
  return Array.isArray(value) ? value : fallback;
}
