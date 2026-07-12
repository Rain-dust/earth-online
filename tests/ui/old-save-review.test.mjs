import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOldSaveReview,
  getRecoveryCeremony,
} from "../../src/ui/old-save-review.mjs";

test("buildOldSaveReview puts strong-signal candidates first without auto-confirming them", () => {
  const view = buildOldSaveReview({
    achievements: [
      { achievementId: "first-job", source: "old_save_confirmed" },
    ],
    achievementArchive: {
      candidateIds: ["academic-complete", "first-job", "unknown"],
      dismissedIds: ["academic-complete"],
    },
  });

  assert.deepEqual(view.candidates.map((item) => item.id), [
    "academic-complete",
    "first-job",
  ]);
  assert.equal(view.candidates[0].status, "dismissed");
  assert.equal(view.candidates[1].status, "confirmed");
  assert.equal(view.catalog.some((item) => item.id === "academic-complete"), false);
  assert.equal(view.catalog.some((item) => item.id === "first-job"), false);
  assert.equal(view.groups.flatMap((group) => group.items).length, 10);
});

test("buildOldSaveReview tolerates malformed saves and groups the remaining catalog", () => {
  const view = buildOldSaveReview({
    achievements: "broken",
    achievementArchive: { candidateIds: null, dismissedIds: {} },
  });

  assert.deepEqual(view.candidates, []);
  assert.equal(view.catalog.length, 12);
  assert.ok(view.groups.length >= 1);
  assert.ok(view.groups.every((group) => group.items.length > 0));
  assert.ok(view.catalog.every((item) => item.status === "available"));
});

test("duplicate achievement records resolve to one conservative confirmed review item", () => {
  const view = buildOldSaveReview({
    achievements: [
      { id: "self-rescue", hidden: false },
      { achievementId: "self-rescue", hidden: true },
    ],
    achievementArchive: { candidateIds: ["self-rescue"] },
  });

  assert.equal(view.candidates.length, 1);
  assert.equal(view.candidates[0].status, "confirmed");
  assert.equal(view.candidates[0].hidden, true);
});

test("getRecoveryCeremony returns exactly one representative and one batch summary", () => {
  const ceremony = getRecoveryCeremony({
    achievementArchive: {
      lastRecovery: {
        at: "2026-07-11T04:00:00.000Z",
        count: 3,
        representativeId: "self-rescue",
        remainingCount: 2,
      },
    },
  });

  assert.equal(ceremony.representative.id, "self-rescue");
  assert.equal(ceremony.count, 3);
  assert.equal(ceremony.remainingCount, 2);
  assert.equal(ceremony.summary, "旧存档已恢复，新增 3 项人生记录");
});

test("getRecoveryCeremony tolerates private or malformed recovery summaries", () => {
  const ceremony = getRecoveryCeremony({
    achievementArchive: {
      lastRecovery: { count: 2, representativeId: "unknown", remainingCount: 2 },
    },
  });

  assert.equal(ceremony.representative, null);
  assert.equal(ceremony.count, 2);
  assert.equal(ceremony.remainingCount, 2);
  assert.equal(getRecoveryCeremony(null), null);
});
