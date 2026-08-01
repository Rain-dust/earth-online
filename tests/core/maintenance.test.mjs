import test from "node:test";
import assert from "node:assert/strict";
import {
  MAINTENANCE_CATALOG,
  RUNTIME_STATUSES,
  STATUS_LABELS,
  normalizeRuntimeStatus,
} from "../../src/core/constants.mjs";
import {
  replaceMaintenance,
  selectMaintenance,
} from "../../src/core/maintenance.mjs";
import { DAILY_MISSION_CATALOG } from "../../src/core/daily-mission-catalog.mjs";

test("runtime statuses expose exactly five visible choices", () => {
  const statuses = Object.values(RUNTIME_STATUSES);

  assert.deepEqual(statuses, [
    "stable_operation",
    "high_load",
    "low_energy",
    "lost_route",
    "main_quest_push",
  ]);
  assert.equal(Object.keys(STATUS_LABELS).length, 5);
  assert.equal(statuses.every((status) => STATUS_LABELS[status]), true);
});

test("legacy maintenance status folds into low energy", () => {
  assert.equal(normalizeRuntimeStatus("maintenance_mode"), RUNTIME_STATUSES.LOW_ENERGY);
  assert.equal(normalizeRuntimeStatus("unknown"), RUNTIME_STATUSES.STABLE);
});

test("each status has at least four concrete maintenance candidates", () => {
  for (const status of Object.values(RUNTIME_STATUSES)) {
    const candidates = MAINTENANCE_CATALOG.filter((item) => item.statuses.includes(status));

    assert.ok(candidates.length >= 4, `${status} should have four candidates`);
    assert.equal(candidates.every((item) => item.title.trim() && item.maxMinutes <= 20), true);
  }
});

test("selectMaintenance avoids the previous fourteen dates and excluded items", () => {
  const selected = selectMaintenance({
    date: "2026-07-13",
    status: RUNTIME_STATUSES.STABLE,
    recentRuns: [
      { date: "2026-07-12", maintenance: { itemId: "drink-water" } },
      { date: "2026-07-11", maintenance: { itemId: "stretch-five" } },
      { date: "2026-07-10", maintenance: { itemId: "clear-visible-item" } },
    ],
    preferences: {
      excludedIds: ["reply-important-message"],
      customItems: [{ id: "custom-air", title: "开窗通风 3 分钟", maxMinutes: 3 }],
    },
  });

  assert.equal([
    "drink-water",
    "stretch-five",
    "clear-visible-item",
    "reply-important-message",
  ].includes(selected.itemId), false);
  assert.equal(selected.itemId, "custom-air");
  assert.equal(selected.source, "custom");
});

test("selectMaintenance is deterministic for the same date and status", () => {
  const input = {
    date: "2026-07-13",
    status: RUNTIME_STATUSES.HIGH_LOAD,
    recentRuns: [],
    preferences: { excludedIds: [], customItems: [] },
  };

  assert.deepEqual(selectMaintenance(input), selectMaintenance(input));
});

test("replaceMaintenance replaces once and never returns the same item that day", () => {
  const context = {
    date: "2026-07-13",
    status: RUNTIME_STATUSES.HIGH_LOAD,
    recentRuns: [],
    preferences: { excludedIds: [], customItems: [] },
  };
  const original = selectMaintenance(context);
  const replaced = replaceMaintenance(original, context);
  const repeated = replaceMaintenance(replaced, context);

  assert.notEqual(replaced.itemId, original.itemId);
  assert.equal(replaced.replacementCount, 1);
  assert.equal(replaced.replacedFrom, original.itemId);
  assert.equal(repeated, replaced);
});

test("selectMaintenance returns a safe fallback when every candidate is excluded", () => {
  const selected = selectMaintenance({
    date: "2026-07-13",
    status: RUNTIME_STATUSES.STABLE,
    recentRuns: [],
    preferences: {
      excludedIds: DAILY_MISSION_CATALOG.map((item) => item.id),
      customItems: [],
    },
  });

  assert.equal(selected.itemId, "safe-pause-two");
  assert.equal(selected.title, "离开屏幕，活动 2 分钟。");
});
