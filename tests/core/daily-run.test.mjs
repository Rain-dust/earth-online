import test from "node:test";
import assert from "node:assert/strict";
import {
  acceptDailyMission,
  completeDailyMission,
  deleteFreeRecord,
  ensureDailyRun,
  markDailyMissionPresented,
  recordAdditionalMainProgress,
  refreshDailyMainAction,
  replaceDailyMaintenance,
  saveFreeRecord,
  setDailyStatus,
  skipDailyMission,
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

test("refreshDailyMainAction fills or updates only an unsynced slot", () => {
  const empty = ensureDailyRun({ ...fixtureSaveWithMainQuest(), mainQuest: null }, DATE);
  const active = fixtureSaveWithMainQuest();
  const filled = refreshDailyMainAction({ ...empty, mainQuest: active.mainQuest }, DATE);

  assert.equal(filled.dailyRuns[0].mainAction.text, "完成数据迁移");

  const updatedQuest = {
    ...active.mainQuest,
    currentAction: { id: "action-2", text: "完成清晨面板" },
  };
  const updated = refreshDailyMainAction({ ...filled, mainQuest: updatedQuest }, DATE);

  assert.equal(updated.dailyRuns[0].mainAction.text, "完成清晨面板");

  const synced = syncMainAction(updated, DATE, FIRST_AT);
  const preserved = refreshDailyMainAction({
    ...synced,
    mainQuest: {
      ...updatedQuest,
      currentAction: { id: "action-3", text: "不应覆盖已同步记录" },
    },
  }, DATE);

  assert.equal(preserved.dailyRuns[0].mainAction.text, "完成清晨面板");
});

test("refreshDailyMainAction does not carry progress into a different quest", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const withProgress = recordAdditionalMainProgress(
    save,
    DATE,
    "完成旧主线的第一轮验证",
    FIRST_AT,
    { idFactory: () => "old-progress" },
  );
  const switched = refreshDailyMainAction({
    ...withProgress,
    mainQuest: {
      id: "quest-2",
      title: "开始新的主线",
      status: "active",
      currentAction: { id: "action-2", text: "整理新主线的第一步" },
    },
  }, DATE);

  assert.equal(switched.dailyRuns[0].mainAction.questId, "quest-2");
  assert.deepEqual(switched.dailyRuns[0].mainAction.additionalProgress, []);
});

test("v0.4 daily mission tracks presentation, acceptance and skip without EXP", () => {
  const initial = ensureDailyRun(fixtureSaveWithMainQuest(), DATE);
  const presented = markDailyMissionPresented(initial, DATE, FIRST_AT);
  const accepted = acceptDailyMission(presented, DATE, "2026-07-13T08:01:00.000Z");
  const skipped = skipDailyMission(initial, DATE, "2026-07-13T08:02:00.000Z");

  assert.equal(presented.dailyRuns[0].maintenance.presentedAt, FIRST_AT);
  assert.equal(accepted.dailyRuns[0].maintenance.acceptedAt, "2026-07-13T08:01:00.000Z");
  assert.equal(skipped.dailyRuns[0].maintenance.skippedAt, "2026-07-13T08:02:00.000Z");
  assert.equal(accepted.level.exp, 0);
  assert.deepEqual(accepted.rewardLedger, []);
});

test("v0.4 daily mission completion changes attributes without granting legacy EXP", () => {
  const initial = acceptDailyMission(
    ensureDailyRun(fixtureSaveWithMainQuest(), DATE),
    DATE,
    FIRST_AT,
  );
  const completion = completeDailyMission(
    initial,
    DATE,
    "2026-07-13T08:05:00.000Z",
  );
  const repeated = completeDailyMission(
    completion.save,
    DATE,
    "2026-07-13T08:06:00.000Z",
  );

  assert.equal(completion.save.level.exp, 0);
  assert.deepEqual(completion.save.rewardLedger, []);
  assert.ok(completion.result.attributeChanges.length >= 1);
  assert.equal(completion.result.effect.remainingMinutes, 45);
  assert.equal(
    completion.save.activityEvents.filter((event) => event.type === "daily_mission_completed").length,
    1,
  );
  assert.equal(repeated.result, null);
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
