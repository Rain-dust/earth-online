import test from "node:test";
import assert from "node:assert/strict";
import {
  completeOldSaveReview,
  confirmOldSaveAchievement,
  createEmptyAchievementArchive,
  dismissOldSaveAchievement,
  getAchievementInstanceId,
  getOldSaveCandidateIds,
  normalizeAchievementArchive,
  restoreDismissedOldSaveAchievement,
  revokeOldSaveAchievement,
  setAchievementPresentation,
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
    firstNightEnteredAt: " 2026-07-10T16:00:00.000Z ",
    lastSwitchDate: "  2026-07-11  ",
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

test("getOldSaveCandidateIds returns only strong signals in catalog order", () => {
  assert.deepEqual(
    getOldSaveCandidateIds({
      educationStage: "undergraduate",
      currentStage: "working",
      setbackRecovery: "recovered",
      stableSkillCount: 8,
      projectCount: 12,
      lifeMethod: "reusable_system",
    }),
    ["academic-complete", "first-job", "self-rescue"],
  );
  assert.deepEqual(
    getOldSaveCandidateIds({
      educationStage: "graduate",
      currentStage: "freelancing",
      setbackRecovery: "repeated_recovery",
    }),
    ["academic-complete", "first-job", "self-rescue"],
  );
  assert.deepEqual(
    getOldSaveCandidateIds({
      educationStage: "high_school",
      currentStage: "studying",
      setbackRecovery: "recovering",
      stableSkillCount: 8,
      projectCount: 12,
    }),
    [],
  );
});

test("confirmOldSaveAchievement ignores unknown IDs and creates one exact canonical record", () => {
  const save = {
    achievements: [],
    achievementArchive: {
      ...createEmptyAchievementArchive(),
      candidateIds: ["academic-complete"],
      dismissedIds: ["academic-complete", "first-job"],
    },
  };
  const before = structuredClone(save);

  assert.equal(confirmOldSaveAchievement(save, "unknown-id", "later"), save);

  const confirmed = confirmOldSaveAchievement(
    save,
    "academic-complete",
    "2026-07-11T01:00:00.000Z",
  );

  assert.deepEqual(confirmed.achievements, [
    {
      achievementId: "academic-complete",
      unlockedAt: "2026-07-11T01:00:00.000Z",
      source: "old_save_confirmed",
      hidden: false,
      displayable: true,
      spotlightAllowed: true,
    },
  ]);
  assert.deepEqual(confirmed.achievementArchive.dismissedIds, ["first-job"]);
  assert.deepEqual(save, before);
  assert.notEqual(confirmed, save);
  assert.notEqual(confirmed.achievements, save.achievements);
});

test("confirmOldSaveAchievement does not duplicate canonical or legacy records", () => {
  const canonical = {
    achievements: [{ achievementId: "academic-complete", source: "runtime" }],
    achievementArchive: {
      ...createEmptyAchievementArchive(),
      dismissedIds: ["academic-complete"],
    },
  };
  const legacy = {
    achievements: [{ id: "first-job", source: "old_save_confirmed", note: "legacy" }],
    achievementArchive: createEmptyAchievementArchive(),
  };

  const confirmedCanonical = confirmOldSaveAchievement(canonical, "academic-complete", "later");
  const confirmedLegacy = confirmOldSaveAchievement(legacy, "first-job", "later");

  assert.deepEqual(confirmedCanonical.achievements, canonical.achievements);
  assert.deepEqual(confirmedCanonical.achievementArchive.dismissedIds, []);
  assert.deepEqual(confirmedLegacy.achievements, legacy.achievements);
  assert.deepEqual(canonical.achievementArchive.dismissedIds, ["academic-complete"]);
  assert.equal(legacy.achievements.length, 1);
});

test("dismiss and restore update dismissed IDs once without deleting confirmed records", () => {
  const record = { achievementId: "academic-complete", source: "old_save_confirmed" };
  const save = {
    achievements: [record],
    achievementArchive: createEmptyAchievementArchive(),
  };
  const before = structuredClone(save);

  const dismissedOnce = dismissOldSaveAchievement(save, "academic-complete");
  const dismissedTwice = dismissOldSaveAchievement(dismissedOnce, "academic-complete");
  const restored = restoreDismissedOldSaveAchievement(dismissedTwice, "academic-complete");

  assert.deepEqual(dismissedTwice.achievementArchive.dismissedIds, ["academic-complete"]);
  assert.deepEqual(dismissedTwice.achievements, [record]);
  assert.deepEqual(restored.achievementArchive.dismissedIds, []);
  assert.deepEqual(restored.achievements, [record]);
  assert.deepEqual(save, before);
  assert.equal(dismissOldSaveAchievement(save, "unknown-id"), save);
});

test("setAchievementPresentation supports legacy IDs and ignores non-boolean values", () => {
  const save = {
    achievements: [
      {
        id: "academic-complete",
        source: "old_save_confirmed",
        hidden: false,
        displayable: true,
        spotlightAllowed: true,
        note: "preserve me",
      },
      { achievementId: "first-job", source: "runtime", hidden: false },
    ],
    achievementArchive: createEmptyAchievementArchive(),
  };
  const before = structuredClone(save);

  const updated = setAchievementPresentation(save, "academic-complete", {
    hidden: true,
    displayable: "false",
    spotlightAllowed: null,
    source: "tampered",
    note: "replace me",
  });

  assert.deepEqual(updated.achievements[0], {
    id: "academic-complete",
    source: "old_save_confirmed",
    hidden: true,
    displayable: true,
    spotlightAllowed: true,
    note: "preserve me",
  });
  assert.equal(updated.achievements[1], save.achievements[1]);
  assert.deepEqual(save, before);
  assert.equal(setAchievementPresentation(save, "missing", { hidden: true }), save);
});

test("revokeOldSaveAchievement removes only confirmed old-save records and restores review state", () => {
  const save = {
    achievements: [
      { achievementId: "academic-complete", source: "old_save_confirmed" },
      { id: "academic-complete", source: "runtime", note: "keep runtime" },
      { achievementId: "academic-complete", source: "imported", note: "keep unknown source" },
      { id: "first-job", source: "old_save_confirmed", note: "legacy old save" },
      { achievementId: "self-rescue", source: "old_save_confirmed" },
    ],
    achievementArchive: {
      ...createEmptyAchievementArchive(),
      candidateIds: ["academic-complete", "academic-complete"],
      dismissedIds: ["academic-complete", "self-rescue"],
    },
  };
  const before = structuredClone(save);

  const revokedCanonical = revokeOldSaveAchievement(save, "academic-complete");
  const revokedLegacy = revokeOldSaveAchievement(revokedCanonical, "first-job");

  assert.deepEqual(revokedCanonical.achievements, [
    { id: "academic-complete", source: "runtime", note: "keep runtime" },
    { achievementId: "academic-complete", source: "imported", note: "keep unknown source" },
    { id: "first-job", source: "old_save_confirmed", note: "legacy old save" },
    { achievementId: "self-rescue", source: "old_save_confirmed" },
  ]);
  assert.deepEqual(revokedCanonical.achievementArchive.candidateIds, ["academic-complete"]);
  assert.deepEqual(revokedCanonical.achievementArchive.dismissedIds, ["self-rescue"]);
  assert.equal(
    revokedLegacy.achievements.some((record) => getAchievementInstanceId(record) === "first-job"),
    false,
  );
  assert.deepEqual(revokedLegacy.achievementArchive.candidateIds, [
    "academic-complete",
    "first-job",
  ]);
  assert.deepEqual(save, before);
  assert.equal(revokeOldSaveAchievement(save, "unknown-id"), save);
});

test("completeOldSaveReview uses catalog rarity and respects privacy eligibility", () => {
  const save = {
    achievements: [
      { achievementId: "paid-home", source: "old_save_confirmed", hidden: true },
      {
        achievementId: "financial-freedom",
        source: "old_save_confirmed",
        spotlightAllowed: false,
      },
      {
        id: "driver-license-hunter",
        source: "old_save_confirmed",
        rarityPercent: 99,
      },
      {
        achievementId: "self-rescue",
        source: "old_save_confirmed",
        rarityPercent: 0,
      },
      { achievementId: "first-job", source: "runtime" },
      { achievementId: "not-in-catalog", source: "old_save_confirmed" },
    ],
    achievementArchive: createEmptyAchievementArchive(),
  };
  const before = structuredClone(save);

  const completed = completeOldSaveReview(save, "2026-07-11T03:00:00.000Z");

  assert.equal(completed.achievementArchive.scanStatus, "complete");
  assert.deepEqual(completed.achievementArchive.lastRecovery, {
    at: "2026-07-11T03:00:00.000Z",
    count: 4,
    representativeId: "driver-license-hunter",
    remainingCount: 3,
  });
  assert.deepEqual(save, before);
});

test("completeOldSaveReview breaks rarity ties by catalog order", () => {
  const completed = completeOldSaveReview(
    {
      achievements: [
        { achievementId: "keep-passion", source: "old_save_confirmed" },
        { id: "true-bond", source: "old_save_confirmed" },
      ],
      achievementArchive: createEmptyAchievementArchive(),
    },
    "2026-07-11T04:00:00.000Z",
  );

  assert.equal(completed.achievementArchive.lastRecovery.representativeId, "true-bond");
  assert.equal(completed.achievementArchive.lastRecovery.remainingCount, 1);
});

test("completeOldSaveReview records no representative when all confirmed records are private", () => {
  const completed = completeOldSaveReview(
    {
      achievements: [
        { achievementId: "paid-home", source: "old_save_confirmed", hidden: true },
        {
          id: "financial-freedom",
          source: "old_save_confirmed",
          spotlightAllowed: false,
        },
        { achievementId: "first-job", source: "runtime" },
        { achievementId: "not-in-catalog", source: "old_save_confirmed" },
      ],
      achievementArchive: createEmptyAchievementArchive(),
    },
    "2026-07-11T05:00:00.000Z",
  );

  assert.deepEqual(completed.achievementArchive.lastRecovery, {
    at: "2026-07-11T05:00:00.000Z",
    count: 2,
    representativeId: null,
    remainingCount: 2,
  });
});

test("completeOldSaveReview ignores malformed achievement entries", () => {
  const completed = completeOldSaveReview(
    {
      achievements: [
        null,
        undefined,
        42,
        "academic-complete",
        [],
        {},
        { achievementId: "true-bond", source: "old_save_confirmed" },
      ],
      achievementArchive: createEmptyAchievementArchive(),
    },
    "2026-07-11T06:00:00.000Z",
  );

  assert.deepEqual(completed.achievementArchive.lastRecovery, {
    at: "2026-07-11T06:00:00.000Z",
    count: 1,
    representativeId: "true-bond",
    remainingCount: 0,
  });
});

test("completeOldSaveReview counts duplicate IDs once and aggregates privacy conservatively", () => {
  const completed = completeOldSaveReview(
    {
      achievements: [
        { achievementId: "true-bond", source: "old_save_confirmed" },
        { id: "true-bond", source: "old_save_confirmed", hidden: true },
        { achievementId: "driver-license-hunter", source: "old_save_confirmed" },
        {
          id: "driver-license-hunter",
          source: "old_save_confirmed",
          spotlightAllowed: false,
        },
        { achievementId: "keep-passion", source: "old_save_confirmed" },
        { id: "keep-passion", source: "runtime", hidden: true },
        { achievementId: "not-in-catalog", source: "old_save_confirmed" },
      ],
      achievementArchive: createEmptyAchievementArchive(),
    },
    "2026-07-11T07:00:00.000Z",
  );

  assert.deepEqual(completed.achievementArchive.lastRecovery, {
    at: "2026-07-11T07:00:00.000Z",
    count: 3,
    representativeId: "keep-passion",
    remainingCount: 2,
  });
});
