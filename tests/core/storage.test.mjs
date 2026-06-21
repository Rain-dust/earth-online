import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptySave,
  exportSave,
  importSave,
  SAVE_FORMAT,
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
