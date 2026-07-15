import test from "node:test";
import assert from "node:assert/strict";
import {
  deleteFreeRecord,
  ensureDailyRun,
  recordAdditionalMainProgress,
  replaceDailyMaintenance,
  saveFreeRecord,
  setDailyStatus,
  syncMainAction,
  syncMaintenance,
} from "../../src/core/daily-run.mjs";

const DATE = "2026-07-13";
const FIRST_AT = "2026-07-13T08:00:00.000Z";

test("ensureDailyRun creates exactly three semantic slots", () => {
  const next = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const run = next.dailyRuns[0];

  assert.equal(run.mainAction.text, "完成数据迁移");
  assert.ok(run.maintenance.itemId);
  assert.equal(run.freeRecord, null);
  assert.equal(run.status, "stable_operation");
});

test("ensureDailyRun reuses an existing date and supports an empty main quest", () => {
  const empty = { ...fixtureSaveWithMainQuest(), mainQuest: null };
  const first = ensureDailyRun(empty, DATE);
  const second = ensureDailyRun(first, DATE);

  assert.equal(first.dailyRuns[0].mainAction, null);
  assert.equal(second, first);
});

test("formal main sync rewards once while extra progress remains recordable", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const first = syncMainAction(save, DATE, FIRST_AT);
  const repeated = syncMainAction(first, DATE, "2026-07-13T08:01:00.000Z");
  const extra = recordAdditionalMainProgress(
    repeated,
    DATE,
    "完成额外回归",
    "2026-07-13T09:00:00.000Z",
    { idFactory: () => "progress-1" },
  );

  assert.equal(extra.level.exp, 20);
  assert.equal(extra.rewardLedger.length, 1);
  assert.equal(extra.activityEvents.filter((event) => event.type === "main_action_synced").length, 1);
  assert.equal(extra.activityEvents.filter((event) => event.type === "main_progress_added").length, 1);
  assert.equal(extra.dailyRuns[0].mainAction.additionalProgress[0].text, "完成额外回归");
});

test("maintenance sync rewards eight experience once", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const first = syncMaintenance(save, DATE, FIRST_AT);
  const second = syncMaintenance(first, DATE, "2026-07-13T08:01:00.000Z");

  assert.equal(first.level.exp, 8);
  assert.equal(second.level.exp, 8);
  assert.equal(second.activityEvents.filter((event) => event.type === "maintenance_synced").length, 1);
});

test("free record rewards once across edits and deletion", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const first = saveFreeRecord(save, DATE, {
    text: "完成了第一批核心测试",
    category: "progress",
    important: true,
  }, FIRST_AT);
  const edited = saveFreeRecord(first, DATE, {
    text: "完成了核心数据层",
    category: "progress",
    important: false,
  }, "2026-07-13T09:00:00.000Z");
  const deleted = deleteFreeRecord(edited, DATE, "2026-07-13T10:00:00.000Z");

  assert.equal(first.level.exp, 8);
  assert.equal(edited.level.exp, 8);
  assert.equal(deleted.level.exp, 8);
  assert.equal(deleted.dailyRuns[0].freeRecord, null);
  assert.deepEqual(deleted.activityEvents.map((event) => event.type), [
    "free_record_saved",
    "free_record_updated",
    "free_record_deleted",
  ]);
});

test("daily maintenance can be replaced only once", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const originalId = save.dailyRuns[0].maintenance.itemId;
  const replaced = replaceDailyMaintenance(save, DATE);
  const repeated = replaceDailyMaintenance(replaced, DATE);

  assert.notEqual(replaced.dailyRuns[0].maintenance.itemId, originalId);
  assert.equal(repeated, replaced);
});

test("status change updates untouched maintenance and preserves handled maintenance", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const changed = setDailyStatus(save, DATE, "high_load");
  const completed = syncMaintenance(changed, DATE, FIRST_AT);
  const preserved = setDailyStatus(completed, DATE, "low_energy");

  assert.equal(changed.dailyRuns[0].status, "high_load");
  assert.equal(changed.currentStatus, "high_load");
  assert.equal(changed.dailyRuns[0].maintenance.status, "high_load");
  assert.equal(preserved.dailyRuns[0].status, "low_energy");
  assert.equal(preserved.dailyRuns[0].maintenance.itemId, completed.dailyRuns[0].maintenance.itemId);
});

function fixtureSaveWithMainQuest() {
  return {
    mainQuest: {
      id: "quest-1",
      title: "完成 Earth Online v0.3",
      status: "active",
      currentAction: {
        id: "action-1",
        text: "完成数据迁移",
      },
    },
    mainQuestArchive: [],
    currentStatus: "stable_operation",
    dailyRuns: [],
    activityEvents: [],
    rewardLedger: [],
    weeklyArchive: [],
    maintenancePreferences: { excludedIds: [], customItems: [] },
    level: { value: 1, exp: 0, nextLevelExp: 16, progress: 0 },
  };
}
