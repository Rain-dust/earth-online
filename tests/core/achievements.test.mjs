import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyAchievementArchive,
  getAchievementInstanceId,
  normalizeAchievementArchive,
} from "../../src/core/achievements.mjs";

test("createEmptyAchievementArchive returns the exact initial archive", () => {
  assert.deepEqual(createEmptyAchievementArchive(), {
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

test("getAchievementInstanceId prefers canonical IDs and supports legacy IDs", () => {
  assert.equal(
    getAchievementInstanceId({ achievementId: " canonical-id ", id: "legacy-id" }),
    "canonical-id",
  );
  assert.equal(getAchievementInstanceId({ id: " legacy-id " }), "legacy-id");
  assert.equal(getAchievementInstanceId({ achievementId: "  ", id: " fallback-id " }), "fallback-id");
  assert.equal(getAchievementInstanceId({ achievementId: 42, id: null }), "");
  assert.equal(getAchievementInstanceId(null), "");
});

test("normalizeAchievementArchive accepts malformed values and sanitizes ID arrays", () => {
  const defaults = createEmptyAchievementArchive();

  assert.deepEqual(normalizeAchievementArchive(), defaults);
  assert.deepEqual(normalizeAchievementArchive(null), defaults);
  assert.deepEqual(normalizeAchievementArchive(["not", "an", "archive"]), defaults);
  assert.deepEqual(normalizeAchievementArchive("not an archive"), defaults);

  const candidateIds = [" first ", "", "first", 42, "second", " second "];
  const dismissedIds = [" dismissed ", null, "dismissed", "  "];
  const normalized = normalizeAchievementArchive({
    version: 3,
    scanStatus: "complete",
    candidateIds,
    dismissedIds,
    switchCount: 4,
    lastRecovery: { recoveredAt: "2026-07-11T00:00:00.000Z" },
  });

  assert.deepEqual(normalized, {
    version: 3,
    scanStatus: "complete",
    candidateIds: ["first", "second"],
    dismissedIds: ["dismissed"],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 4,
    lastRecovery: { recoveredAt: "2026-07-11T00:00:00.000Z" },
  });
  assert.notEqual(normalized.candidateIds, candidateIds);
  assert.notEqual(normalized.dismissedIds, dismissedIds);
});
