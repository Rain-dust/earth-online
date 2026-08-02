import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../../src/core/storage.mjs";
import {
  createEmptySave,
  exportSave,
  importSave,
  loadLocalSave,
  readLocalSaveSnapshot,
  SAVE_FORMAT,
  SCHEMA_VERSION,
  saveLocalSave,
  STORAGE_KEY,
} from "../../src/core/storage.mjs";

const NOW = "2026-07-21T08:00:00.000Z";

test("save format and storage key remain at v1", () => {
  assert.equal(SAVE_FORMAT, "earth-online-save-v1");
  assert.equal(STORAGE_KEY, "earth-online-save-v1");
  assert.equal(SCHEMA_VERSION, 4);
});

test("createEmptySave returns versioned readable save shell", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.equal(save.format, SAVE_FORMAT);
  assert.equal(save.schemaVersion, 4);
  assert.equal(save.exportedAt, "2026-06-21T20:24:00+08:00");
  assert.equal(save.systemNote, "旧存档仍在运行");
  assert.deepEqual(save.profile, null);
  assert.deepEqual(save.dailyTasks, []);
  assert.deepEqual(save.correctionLog, []);
  assert.deepEqual(save.mainQuestArchive, []);
  assert.deepEqual(save.dailyRuns, []);
  assert.deepEqual(save.activityEvents, []);
  assert.deepEqual(save.rewardLedger, []);
  assert.deepEqual(save.weeklyArchive, []);
  assert.deepEqual(save.maintenancePreferences, {
    excludedIds: [],
    customItems: [],
  });
  assert.deepEqual(save.onboarding, {
    version: 2,
    status: "not_started",
    completedSteps: [],
    skippedSteps: [],
    lastStep: "player_name",
    draft: {},
  });
  assert.deepEqual(save.connection, {
    firstConnectedAt: null,
    lastActiveAt: null,
    lastBroadcastAt: null,
  });
  assert.deepEqual(save.achievementArchive, {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    rejectedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
  });
});

test("importSave migrates a v0.2 main quest without losing legacy data", () => {
  const legacy = createEmptySave("2026-07-12T23:00:00.000Z");
  delete legacy.schemaVersion;
  legacy.mainQuest = {
    title: "完成 Earth Online",
    nextStep: "整理 v0.3 规格",
  };
  legacy.dailyTasks = [{ id: "legacy-task", date: "2026-07-12" }];

  const imported = importSave(JSON.stringify(legacy));

  assert.equal(imported.schemaVersion, 4);
  assert.equal(imported.mainQuest.id, "legacy-main-quest");
  assert.equal(imported.mainQuest.status, "active");
  assert.equal(imported.mainQuest.currentAction.text, "整理 v0.3 规格");
  assert.deepEqual(imported.dailyTasks, legacy.dailyTasks);
});

test("importSave gives an empty v2 save a resumable v0.4 shell", () => {
  const legacy = createEmptySave("2026-07-12T23:00:00.000Z");
  legacy.schemaVersion = 2;
  delete legacy.onboarding;
  delete legacy.connection;

  const imported = importSave(JSON.stringify(legacy));

  assert.equal(imported.schemaVersion, 4);
  assert.equal(imported.onboarding.status, "not_started");
  assert.equal(imported.onboarding.lastStep, "player_name");
  assert.deepEqual(imported.connection, {
    firstConnectedAt: null,
    lastActiveAt: null,
    lastBroadcastAt: null,
  });
});

test("importSave marks a legacy profile as already onboarded", () => {
  const legacy = createEmptySave("2026-07-12T23:00:00.000Z");
  legacy.schemaVersion = 2;
  legacy.profile = { nickname: "旧玩家", createdAt: legacy.exportedAt };
  delete legacy.onboarding;

  const imported = importSave(JSON.stringify(legacy));

  assert.equal(imported.onboarding.status, "complete");
  assert.equal(imported.onboarding.lastStep, "complete");
  assert.deepEqual(imported.profile, {
    ...legacy.profile,
    locationSetupStatus: "unseen",
  });
});

test("importSave preserves an interrupted v0.4 onboarding draft", () => {
  const save = createEmptySave("2026-07-18T08:00:00.000Z");
  save.onboarding = {
    version: 1,
    status: "in_progress",
    completedSteps: ["player_name"],
    skippedSteps: ["life_stage"],
    lastStep: "birthday",
    draft: { nickname: "Rain-dust" },
  };

  const imported = importSave(JSON.stringify(save));

  assert.equal(imported.profile, null);
  assert.equal(imported.onboarding.status, "in_progress");
  assert.equal(imported.onboarding.lastStep, "location");
  assert.deepEqual(imported.onboarding.draft, { nickname: "Rain-dust" });
});

test("importSave repairs malformed onboarding and connection fields", () => {
  const save = createEmptySave("2026-07-18T08:00:00.000Z");
  save.onboarding = {
    status: "future",
    completedSteps: "invalid",
    skippedSteps: null,
    lastStep: "unknown",
    draft: [],
  };
  save.connection = {
    firstConnectedAt: 42,
    lastActiveAt: "2026-07-18T08:01:00.000Z",
    lastBroadcastAt: false,
    futureConnectionField: { retained: true },
  };

  const imported = importSave(JSON.stringify(save));

  assert.equal(imported.onboarding.status, "not_started");
  assert.equal(imported.onboarding.lastStep, "player_name");
  assert.deepEqual(imported.onboarding.draft, {});
  assert.deepEqual(imported.connection, {
    firstConnectedAt: null,
    lastActiveAt: "2026-07-18T08:01:00.000Z",
    lastBroadcastAt: null,
    futureConnectionField: { retained: true },
  });
});

test("schema v3 export-import keeps unknown root fields", () => {
  const save = createEmptySave("2026-07-18T08:00:00.000Z");
  save.futureRootField = { mode: "still-readable" };
  save.connection.futureConnectionField = "preserved";

  const imported = importSave(exportSave(save));

  assert.deepEqual(imported.futureRootField, { mode: "still-readable" });
  assert.equal(imported.connection.futureConnectionField, "preserved");
});

test("importSave migrates a legacy string main quest", () => {
  const legacy = createEmptySave("2026-07-12T23:00:00.000Z");
  delete legacy.schemaVersion;
  legacy.mainQuest = "完成 Earth Online";

  const imported = importSave(JSON.stringify(legacy));

  assert.equal(imported.mainQuest.title, "完成 Earth Online");
  assert.equal(imported.mainQuest.currentAction.text, "完成 Earth Online");
});

test("importSave normalizes malformed v0.3 collections", () => {
  const save = createEmptySave("2026-07-12T23:00:00.000Z");
  save.mainQuestArchive = {};
  save.dailyRuns = "invalid";
  save.activityEvents = null;
  save.rewardLedger = 3;
  save.weeklyArchive = false;
  save.maintenancePreferences = {
    excludedIds: [" stretch-five ", "stretch-five", "", 12],
    customItems: { title: "invalid" },
  };

  const imported = importSave(JSON.stringify(save));

  assert.deepEqual(imported.mainQuestArchive, []);
  assert.deepEqual(imported.dailyRuns, []);
  assert.deepEqual(imported.activityEvents, []);
  assert.deepEqual(imported.rewardLedger, []);
  assert.deepEqual(imported.weeklyArchive, []);
  assert.deepEqual(imported.maintenancePreferences, {
    excludedIds: ["stretch-five"],
    customItems: [],
  });
});

test("exportSave returns stable pretty JSON", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  const json = exportSave(save);

  assert.match(json, /"format": "earth-online-save-v1"/);
  assert.match(json, /"systemNote": "旧存档仍在运行"/);
  assert.equal(JSON.parse(json).format, SAVE_FORMAT);
});

test("exportSave gives saves without an achievement archive the default archive", () => {
  const oldSave = createEmptySave("2026-06-21T20:24:00+08:00");
  delete oldSave.achievementArchive;

  const exported = JSON.parse(exportSave(oldSave));

  assert.deepEqual(exported.achievementArchive, {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    rejectedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
  });
});

test("importSave rejects unknown formats without mutating current save", () => {
  const current = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.throws(
    () => importSave('{"format":"wrong"}', current),
    /Unsupported save format/,
  );
  assert.equal(current.format, SAVE_FORMAT);
});

test("importSave gives old saves a default achievement archive", () => {
  const oldSave = createEmptySave("2026-06-21T20:24:00+08:00");
  delete oldSave.achievementArchive;

  const imported = importSave(JSON.stringify(oldSave));

  assert.deepEqual(imported.achievementArchive, {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    rejectedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
  });
});

test("importSave normalizes malformed achievement archive fields", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  save.achievementArchive = {
    scanStatus: "complete",
    candidateIds: [" first ", "first", "", 12],
    dismissedIds: "not-an-array",
    switchCount: 2,
  };

  const imported = importSave(JSON.stringify(save));

  assert.equal(imported.achievementArchive.scanStatus, "complete");
  assert.deepEqual(imported.achievementArchive.candidateIds, ["first"]);
  assert.deepEqual(imported.achievementArchive.dismissedIds, []);
  assert.equal(imported.achievementArchive.switchCount, 2);
});

test("importSave preserves unknown legacy achievements unchanged", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  const unknownLegacyAchievement = {
    id: "legacy-achievement-that-is-not-in-the-catalog",
    unlockedAt: "2025-12-31T16:00:00.000Z",
    metadata: { source: "legacy-save" },
  };
  save.achievements = [unknownLegacyAchievement];

  const imported = importSave(JSON.stringify(save));

  assert.deepEqual(imported.achievements, [unknownLegacyAchievement]);
});

test("archive state and unknown legacy achievements survive an export-import round trip", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  const archive = {
    version: 2,
    scanStatus: "review",
    candidateIds: ["candidate-one", "candidate-two"],
    dismissedIds: ["dismissed-one"],
    rejectedIds: [],
    firstNightEnteredAt: "2026-07-10T16:00:00.000Z",
    lastSwitchDate: "2026-07-11",
    switchCount: 3,
    lastRecovery: {
      recoveredAt: "2026-07-11T00:00:00.000Z",
      source: "archive-scan",
    },
    futureArchiveField: { enabled: true },
  };
  const unknownLegacyAchievement = {
    id: "unknown-legacy-achievement",
    metadata: {
      source: "legacy-save",
      context: { season: "night" },
    },
    presentation: {
      hidden: true,
      featured: false,
      flags: { monochrome: true },
    },
  };
  save.achievementArchive = archive;
  save.achievements = [unknownLegacyAchievement];

  const imported = importSave(exportSave(save));

  assert.deepEqual(imported.achievementArchive, archive);
  assert.deepEqual(imported.achievements, [unknownLegacyAchievement]);
});

test("location survives export-import while old and invalid profiles safely degrade", () => {
  const current = createEmptySave(NOW);
  const location = {
    id: "simplemaps:1566922272", countryCode: "CN", countryName: "China", countryDisplayName: "中国",
    regionCode: null, regionName: "Guangdong", regionDisplayName: "广东",
    cityName: "Shenzhen", cityDisplayName: "深圳", asciiName: "Shenzhen",
    latitude: 22.5431, longitude: 114.0579, population: 17_600_000, capitalType: "admin",
    precision: "city", source: "manual", confirmedByUser: true, confirmedAt: NOW,
  };
  const imported = importSave(exportSave({
    ...current,
    profile: { nickname: "Rain", locationSetupStatus: "confirmed", location },
  }));

  assert.deepEqual(imported.profile.location, location);
  assert.equal(imported.profile.locationSetupStatus, "confirmed");

  const legacy = importSave(exportSave({ ...current, profile: { nickname: "Legacy" } }));
  assert.equal(legacy.profile.location, undefined);
  assert.equal(legacy.profile.locationSetupStatus, "unseen");

  const invalid = importSave(exportSave({
    ...current,
    profile: { nickname: "Broken", locationSetupStatus: "confirmed", location: { ...location, latitude: 200 } },
  }));
  assert.equal(invalid.profile.location, undefined);
  assert.equal(invalid.profile.locationSetupStatus, "unseen");
});

test("loadLocalSave returns empty save when default localStorage is inaccessible", () => {
  withThrowingLocalStorage(() => {
    const save = loadLocalSave();

    assert.equal(save.format, SAVE_FORMAT);
    assert.deepEqual(save.dailyTasks, []);
  });
});

test("saveLocalSave returns save when default localStorage is inaccessible", () => {
  withThrowingLocalStorage(() => {
    const save = createEmptySave("2026-06-21T20:24:00+08:00");

    assert.equal(saveLocalSave(save), save);
  });
});

test("strict local save reads distinguish found, empty, and failed storage", () => {
  const foundSave = createEmptySave("2026-07-20T08:00:00.000Z");
  foundSave.profile = { nickname: "远行者" };
  const found = readLocalSaveSnapshot({
    getItem: () => exportSave(foundSave),
  });
  const empty = readLocalSaveSnapshot({ getItem: () => null });
  const failed = readLocalSaveSnapshot({
    getItem() {
      throw new Error("storage denied");
    },
  });

  assert.equal(found.status, "found");
  assert.equal(found.save.profile.nickname, "远行者");
  assert.equal(empty.status, "empty");
  assert.equal(empty.save.profile, null);
  assert.equal(failed.status, "error");
  assert.equal(failed.save, null);
  assert.match(failed.error.message, /storage denied/);
});

test("strict local save reports malformed JSON instead of returning an empty save", () => {
  const result = readLocalSaveSnapshot({ getItem: () => "not-json" });

  assert.equal(result.status, "error");
  assert.equal(result.save, null);
  assert.match(result.error.message, /not valid/);
});

test("loadLocalSave uses default localStorage when storage is explicitly undefined", () => {
  const expected = createEmptySave("2026-06-21T20:24:00+08:00");
  const storage = createMemoryStorage();
  storage.setItem(STORAGE_KEY, exportSave(expected));

  withLocalStorage(storage, () => {
    const save = loadLocalSave(undefined);

    assert.equal(save.exportedAt, expected.exportedAt);
    assert.equal(save.format, SAVE_FORMAT);
  });
});

test("saveLocalSave uses default localStorage when storage is explicitly undefined", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  const storage = createMemoryStorage();

  withLocalStorage(storage, () => {
    assert.equal(saveLocalSave(save, undefined), save);
  });

  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).exportedAt, save.exportedAt);
});

test("downloadSaveJson creates a dated JSON download and revokes the object URL", async () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  let clicked = false;
  let createdBlob = null;
  let revokedUrl = null;
  const anchor = {
    download: "",
    href: "",
    click() {
      clicked = true;
    },
    remove() {},
  };
  const documentRef = {
    defaultView: {
      URL: {
        createObjectURL(blob) {
          createdBlob = blob;
          return "blob:earth-online-save";
        },
        revokeObjectURL(url) {
          revokedUrl = url;
        },
      },
    },
    createElement(tagName) {
      assert.equal(tagName, "a");
      return anchor;
    },
    body: {
      appendChild(element) {
        assert.equal(element, anchor);
      },
    },
  };

  storage.downloadSaveJson(save, documentRef);

  assert.equal(clicked, true);
  assert.match(anchor.download, /^earth-online-save-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(anchor.href, "blob:earth-online-save");
  assert.equal(revokedUrl, "blob:earth-online-save");

  const exported = JSON.parse(await createdBlob.text());
  assert.equal(exported.format, SAVE_FORMAT);
  assert.match(exported.exportedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test("readSaveFile rejects empty selections and returns selected file text", async () => {
  await assert.rejects(
    () => storage.readSaveFile(null),
    /No save file selected/,
  );

  await assert.rejects(
    () => storage.readSaveFile(undefined),
    /No save file selected/,
  );

  const text = await storage.readSaveFile({
    text() {
      return Promise.resolve("{\"format\":\"earth-online-save-v1\"}");
    },
  });

  assert.equal(text, "{\"format\":\"earth-online-save-v1\"}");
});

function withThrowingLocalStorage(callback) {
  withLocalStorageGetter(() => {
    throw new Error("localStorage unavailable");
  }, callback);
}

function withLocalStorage(storage, callback) {
  withLocalStorageGetter(() => storage, callback);
}

function withLocalStorageGetter(getStorage, callback) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      return getStorage();
    },
  });

  try {
    callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
}

function createMemoryStorage() {
  const items = new Map();

  return {
    getItem(key) {
      return items.has(key) ? items.get(key) : null;
    },
    setItem(key, value) {
      items.set(key, value);
    },
  };
}
