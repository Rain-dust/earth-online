import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPanelDayUpdate,
  preparePanelDay,
} from "../../src/app/panel-day.mjs";

test("preparePanelDay detects midnight and prepares the current local day", () => {
  const save = {
    mainQuest: null,
    currentStatus: "stable_operation",
    dailyRuns: [{ date: "2026-07-13" }],
    maintenancePreferences: { excludedIds: [], customItems: [] },
  };
  const result = preparePanelDay(save, "2026-07-13", "2026-07-14");

  assert.equal(result.dateChanged, true);
  assert.equal(result.date, "2026-07-14");
  assert.equal(result.save.dailyRuns.some((run) => run.date === "2026-07-14"), true);
});

test("applyPanelDayUpdate keeps the first action after midnight", () => {
  const save = {
    mainQuest: null,
    currentStatus: "stable_operation",
    dailyRuns: [{ date: "2026-07-13" }],
    maintenancePreferences: { excludedIds: [], customItems: [] },
  };
  const result = applyPanelDayUpdate(
    save,
    "2026-07-13",
    (prepared, date) => ({ ...prepared, appliedOn: date }),
    "2026-07-14",
  );

  assert.equal(result.dateChanged, true);
  assert.equal(result.save.appliedOn, "2026-07-14");
});
