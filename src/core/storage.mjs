import {
  createEmptyAchievementArchive,
  normalizeAchievementArchive,
} from "./achievements.mjs";

export const SAVE_FORMAT = "earth-online-save-v1";
export const STORAGE_KEY = "earth-online-save-v1";

export function createEmptySave(exportedAt = new Date().toISOString()) {
  return {
    format: SAVE_FORMAT,
    exportedAt,
    systemNote: "旧存档仍在运行",
    profile: null,
    level: { value: 1, exp: 0, nextLevelExp: 100 },
    currentStatus: null,
    statusHistory: [],
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
    level: { ...defaults.level, ...(save.level || {}) },
    settings: { ...defaults.settings, ...(save.settings || {}) },
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
