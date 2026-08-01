import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildOldSaveSignalReview,
} from "../../src/ui/old-save-signal-review.mjs";

test("signal review prioritizes strong candidates and shows one record at a time", () => {
  const view = buildOldSaveSignalReview({
    achievements: [],
    achievementArchive: {
      candidateIds: ["self-rescue", "academic-complete"],
      dismissedIds: [],
      rejectedIds: [],
    },
  });

  assert.equal(view.item.id, "self-rescue");
  assert.equal(view.item.strongSignal, true);
  assert.equal(view.totalCount, 12);
  assert.equal(view.remainingCount, 12);
});

test("confirmed, rejected and session-seen signals do not reappear", () => {
  const view = buildOldSaveSignalReview({
    achievements: [{ achievementId: "academic-complete" }],
    achievementArchive: {
      candidateIds: ["academic-complete", "first-job"],
      dismissedIds: ["cooking-awakened"],
      rejectedIds: ["first-job"],
    },
  }, {
    seenIds: ["driver-license-hunter"],
  });

  assert.equal(view.item.id, "first-love");
  assert.equal(view.reviewedCount, 3);
  assert.equal(view.deferredCount, 1);
});

test("deferred records return in a later session while rejected records stay resolved", () => {
  const save = {
    achievements: [],
    achievementArchive: {
      candidateIds: [],
      dismissedIds: ["academic-complete"],
      rejectedIds: ["driver-license-hunter"],
    },
  };

  const currentSession = buildOldSaveSignalReview(save, {
    seenIds: [
      "cooking-awakened",
      "first-love",
      "first-job",
      "overseas-checkin",
      "true-bond",
      "self-rescue",
      "keep-passion",
      "wilderness-camp",
      "financial-freedom",
      "paid-home",
    ],
  });
  assert.equal(currentSession.item.id, "academic-complete");

  const laterSession = buildOldSaveSignalReview(save);
  assert.notEqual(laterSession.item.id, "driver-license-hunter");
  assert.equal(laterSession.remainingCount, 11);
});

test("signal review styles stay unframed and include responsive treatment", async () => {
  const styles = await readFile(
    new URL("../../src/styles/achievements.css", import.meta.url),
    "utf8",
  );
  const start = styles.indexOf(".old-save-signal-review");
  const section = styles.slice(start);

  assert.match(section, /position:\s*absolute/);
  assert.match(section, /grid-template-columns/);
  assert.match(section, /@media \(max-width: 760px\), \(max-aspect-ratio: 10 \/ 16\)/);
  assert.doesNotMatch(section.slice(0, section.indexOf(".signal-review-exit")), /border-radius:\s*8px/);
});
