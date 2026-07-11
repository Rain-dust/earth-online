import test from "node:test";
import assert from "node:assert/strict";
import * as storage from "../../src/core/storage.mjs";
import {
  createEmptySave,
  exportSave,
  importSave,
  loadLocalSave,
  SAVE_FORMAT,
  saveLocalSave,
  STORAGE_KEY,
} from "../../src/core/storage.mjs";

test("save format and storage key remain at v1", () => {
  assert.equal(SAVE_FORMAT, "earth-online-save-v1");
  assert.equal(STORAGE_KEY, "earth-online-save-v1");
});

test("createEmptySave returns versioned readable save shell", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.equal(save.format, SAVE_FORMAT);
  assert.equal(save.exportedAt, "2026-06-21T20:24:00+08:00");
  assert.equal(save.systemNote, "旧存档仍在运行");
  assert.deepEqual(save.profile, null);
  assert.deepEqual(save.dailyTasks, []);
  assert.deepEqual(save.correctionLog, []);
  assert.deepEqual(save.achievementArchive, {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
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
