import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptySave,
  exportSave,
  importSave,
  loadLocalSave,
  SAVE_FORMAT,
  saveLocalSave,
} from "../../src/core/storage.mjs";

test("createEmptySave returns versioned readable save shell", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.equal(save.format, SAVE_FORMAT);
  assert.equal(save.exportedAt, "2026-06-21T20:24:00+08:00");
  assert.equal(save.systemNote, "旧存档仍在运行");
  assert.deepEqual(save.profile, null);
  assert.deepEqual(save.dailyTasks, []);
  assert.deepEqual(save.correctionLog, []);
});

test("exportSave returns stable pretty JSON", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  const json = exportSave(save);

  assert.match(json, /"format": "earth-online-save-v1"/);
  assert.match(json, /"systemNote": "旧存档仍在运行"/);
  assert.equal(JSON.parse(json).format, SAVE_FORMAT);
});

test("importSave rejects unknown formats without mutating current save", () => {
  const current = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.throws(
    () => importSave('{"format":"wrong"}', current),
    /Unsupported save format/,
  );
  assert.equal(current.format, SAVE_FORMAT);
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

function withThrowingLocalStorage(callback) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("localStorage unavailable");
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
