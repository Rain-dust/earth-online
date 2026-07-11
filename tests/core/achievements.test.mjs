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

test("normalizeAchievementArchive defaults malformed known scalar fields", () => {
  for (const version of [0, -1, 1.5, "2", null]) {
    assert.equal(normalizeAchievementArchive({ version }).version, 1);
  }

  for (const scanStatus of ["", "done", " pending ", 1, null]) {
    assert.equal(normalizeAchievementArchive({ scanStatus }).scanStatus, "pending");
  }

  for (const field of ["firstNightEnteredAt", "lastSwitchDate"]) {
    for (const value of ["", "   ", 42, {}, []]) {
      assert.equal(normalizeAchievementArchive({ [field]: value })[field], null);
    }
  }

  for (const switchCount of [-1, 1.5, "2", null]) {
    assert.equal(normalizeAchievementArchive({ switchCount }).switchCount, 0);
  }

  for (const lastRecovery of [[], "recovered", new Date(), null]) {
    assert.equal(normalizeAchievementArchive({ lastRecovery }).lastRecovery, null);
  }

  const normalized = normalizeAchievementArchive({
    version: 0,
    futureArchiveField: { enabled: true },
  });
  assert.deepEqual(normalized.futureArchiveField, { enabled: true });
});

test("normalizeAchievementArchive accepts valid scalars and clones lastRecovery", () => {
  const lastRecovery = {
    recoveredAt: "2026-07-11T00:00:00.000Z",
    source: "archive-scan",
  };
  const normalized = normalizeAchievementArchive({
    version: 2,
    scanStatus: "review",
    firstNightEnteredAt: "2026-07-10T16:00:00.000Z",
    lastSwitchDate: "2026-07-11",
    switchCount: 3,
    lastRecovery,
  });

  assert.equal(normalized.version, 2);
  assert.equal(normalized.scanStatus, "review");
  assert.equal(normalized.firstNightEnteredAt, "2026-07-10T16:00:00.000Z");
  assert.equal(normalized.lastSwitchDate, "2026-07-11");
  assert.equal(normalized.switchCount, 3);
  assert.deepEqual(normalized.lastRecovery, lastRecovery);
  assert.notEqual(normalized.lastRecovery, lastRecovery);

  normalized.lastRecovery.source = "normalized-copy";
  assert.equal(lastRecovery.source, "archive-scan");
});
