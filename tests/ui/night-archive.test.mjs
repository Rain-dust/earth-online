import test from "node:test";
import assert from "node:assert/strict";
import {
  buildArchiveView,
  getArchiveSummary,
} from "../../src/ui/night-archive.mjs";

test("buildArchiveView merges canonical and legacy records in catalog order", () => {
  const save = {
    achievements: [
      { achievementId: "paid-home", hidden: true, source: "old_save_confirmed" },
      { id: "driver-license-hunter", hidden: false, source: "old_save_confirmed" },
      { achievementId: "driver-license-hunter", hidden: true, source: "old_save_confirmed" },
      { achievementId: "unknown-record", hidden: false },
      null,
      "malformed",
    ],
  };

  const all = buildArchiveView(save, "all");

  assert.equal(all.length, 12);
  assert.equal(all[0].id, "academic-complete");
  assert.equal(all.at(-1).id, "paid-home");
  assert.equal(all.find((item) => item.id === "driver-license-hunter").confirmed, true);
  assert.equal(all.find((item) => item.id === "driver-license-hunter").hidden, true);
  assert.equal(all.find((item) => item.id === "paid-home").rarityTier.id, "ultra_rare");
});

test("buildArchiveView applies the four approved filters", () => {
  const save = {
    achievements: [
      { achievementId: "driver-license-hunter", hidden: false },
      { achievementId: "paid-home", hidden: true },
    ],
  };

  assert.equal(buildArchiveView(save, "all").length, 12);
  assert.deepEqual(buildArchiveView(save, "confirmed").map((item) => item.id), [
    "driver-license-hunter",
  ]);
  assert.equal(buildArchiveView(save, "unconfirmed").length, 10);
  assert.deepEqual(buildArchiveView(save, "hidden").map((item) => item.id), ["paid-home"]);
  assert.equal(buildArchiveView(save, "not-a-filter").length, 12);
});

test("buildArchiveView tolerates malformed saves", () => {
  assert.equal(buildArchiveView(null).length, 12);
  assert.equal(buildArchiveView({ achievements: {} }).length, 12);
});

test("getArchiveSummary counts unique known records including hidden ones", () => {
  const save = {
    achievements: [
      { achievementId: "paid-home", hidden: true },
      { id: "paid-home", hidden: false },
      { achievementId: "first-job", hidden: false },
      { achievementId: "unknown-record", hidden: false },
    ],
  };

  assert.deepEqual(getArchiveSummary(save), {
    confirmed: 2,
    total: 12,
    hidden: 1,
    label: "2 / 12",
  });
});
