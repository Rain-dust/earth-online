import test from "node:test";
import assert from "node:assert/strict";

import {
  FIRST_SIGNAL_RECORD_ID,
  FIRST_SIGNAL_RECORD_IMAGE,
  FIRST_SIGNAL_RECORD_SOURCE,
  confirmFirstSignalRecord,
  getFirstSignalArchiveView,
  normalizeFirstSignalRecord,
} from "../../src/core/first-signal-archive.mjs";

const NOW = "2026-07-24T12:30:00.000Z";

test("normalization exposes one canonical pending record for absent or malformed data", () => {
  for (const value of [null, [], "recovered", { status: "unknown", rarity: 0.01 }]) {
    assert.deepEqual(normalizeFirstSignalRecord(value), {
      id: FIRST_SIGNAL_RECORD_ID,
      status: "pending",
      source: FIRST_SIGNAL_RECORD_SOURCE,
      confirmedAt: null,
    });
  }
});

test("normalization preserves recovered state while removing ranking-like fields", () => {
  const record = normalizeFirstSignalRecord({
    id: "wrong-id",
    status: "recovered",
    source: "inferred",
    confirmedAt: ` ${NOW} `,
    rarity: "legendary",
    percentage: 0.01,
    ranking: 1,
  });

  assert.deepEqual(record, {
    id: FIRST_SIGNAL_RECORD_ID,
    status: "recovered",
    source: FIRST_SIGNAL_RECORD_SOURCE,
    confirmedAt: NOW,
  });
  assert.deepEqual(Object.keys(record), ["id", "status", "source", "confirmedAt"]);
});

test("confirmation stores the record under achievementArchive and is idempotent", () => {
  const save = {
    player: { name: "Rain" },
    achievementArchive: { scanStatus: "complete", futureField: true },
  };
  const confirmed = confirmFirstSignalRecord(save, NOW);
  const confirmedAgain = confirmFirstSignalRecord(confirmed, "2026-07-25T00:00:00.000Z");

  assert.notEqual(confirmed, save);
  assert.equal(save.achievementArchive.firstSignalRecord, undefined);
  assert.deepEqual(confirmed.achievementArchive, {
    scanStatus: "complete",
    futureField: true,
    firstSignalRecord: {
      id: FIRST_SIGNAL_RECORD_ID,
      status: "recovered",
      source: FIRST_SIGNAL_RECORD_SOURCE,
      confirmedAt: NOW,
    },
  });
  assert.equal(confirmedAgain, confirmed);
});

test("view state is stable and contains only record state plus its image asset", () => {
  const pending = getFirstSignalArchiveView(null);
  const recovered = getFirstSignalArchiveView(confirmFirstSignalRecord({}, NOW));

  assert.equal(pending.status, "pending");
  assert.equal(pending.recovered, false);
  assert.equal(recovered.status, "recovered");
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.imageAsset, FIRST_SIGNAL_RECORD_IMAGE);
  assert.equal("rarity" in recovered, false);
  assert.equal("percentage" in recovered, false);
  assert.equal("ranking" in recovered, false);
});
