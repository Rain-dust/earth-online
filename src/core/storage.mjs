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

export function loadLocalSave(storage = globalThis.localStorage) {
  if (!storage) {
    return createEmptySave();
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptySave();
  }

  return importSave(raw);
}

export function saveLocalSave(save, storage = globalThis.localStorage) {
  if (!storage) {
    return save;
  }

  storage.setItem(STORAGE_KEY, exportSave(save));
  return save;
}

function normalizeSaveForExport(save) {
  return mergeWithDefaults(save, createEmptySave(save.exportedAt));
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
    titles: Array.isArray(save.titles) ? save.titles : defaults.titles,
    tags: Array.isArray(save.tags) ? save.tags : defaults.tags,
    correctionLog: Array.isArray(save.correctionLog) ? save.correctionLog : defaults.correctionLog,
    customTaskPool: Array.isArray(save.customTaskPool) ? save.customTaskPool : defaults.customTaskPool,
  };
}
