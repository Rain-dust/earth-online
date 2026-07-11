import test from "node:test";
import assert from "node:assert/strict";
import {
  getNightTransitionDuration,
  recordNightSwitch,
} from "../../src/core/night-transition.mjs";

test("getNightTransitionDuration uses the reduced-motion duration", () => {
  assert.equal(getNightTransitionDuration({}, "2026-07-12", true), 250);
});

test("getNightTransitionDuration uses the first-night duration without a prior entry", () => {
  assert.equal(getNightTransitionDuration({}, "2026-07-12", false), 2400);
});

test("getNightTransitionDuration uses the new-day duration after a prior entry", () => {
  const archive = {
    firstNightEnteredAt: "2026-07-11T20:00:00+08:00",
    lastSwitchDate: "2026-07-11",
  };

  assert.equal(getNightTransitionDuration(archive, "2026-07-12", false), 1300);
});

test("getNightTransitionDuration uses the repeat duration on the same day", () => {
  const archive = {
    firstNightEnteredAt: "2026-07-12T18:00:00+08:00",
    lastSwitchDate: "2026-07-12",
  };

  assert.equal(getNightTransitionDuration(archive, "2026-07-12", false), 700);
});

test("getNightTransitionDuration tolerates malformed archive values", () => {
  for (const archive of [null, undefined, false, 42, "archive", []]) {
    assert.doesNotThrow(() => getNightTransitionDuration(archive, "2026-07-12", false));
    assert.equal(getNightTransitionDuration(archive, "2026-07-12", false), 2400);
  }

  assert.equal(
    getNightTransitionDuration(
      { firstNightEnteredAt: { invalid: true }, lastSwitchDate: ["2026-07-12"] },
      "2026-07-12",
      false,
    ),
    2400,
  );
});

test("recordNightSwitch increments a valid same-day count and preserves fields", () => {
  const archive = {
    version: 2,
    firstNightEnteredAt: "2026-07-10T20:00:00+08:00",
    lastSwitchDate: "2026-07-12",
    switchCount: 2,
    futureField: { enabled: true },
  };

  assert.deepEqual(recordNightSwitch(archive, "2026-07-12T21:15:00+08:00"), {
    version: 2,
    firstNightEnteredAt: "2026-07-10T20:00:00+08:00",
    lastSwitchDate: "2026-07-12",
    switchCount: 3,
    futureField: { enabled: true },
  });
});

test("recordNightSwitch resets the count on a new day and records the first entry", () => {
  const now = "2026-07-12T06:30:00+08:00";
  const archive = {
    lastSwitchDate: "2026-07-11",
    switchCount: 9,
  };

  assert.deepEqual(recordNightSwitch(archive, now), {
    firstNightEnteredAt: now,
    lastSwitchDate: "2026-07-12",
    switchCount: 1,
  });
});

test("recordNightSwitch defaults to the current ISO timestamp when now is omitted", () => {
  let updated;

  assert.doesNotThrow(() => {
    updated = recordNightSwitch({});
  });
  assert.match(updated.firstNightEnteredAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.match(updated.lastSwitchDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(updated.lastSwitchDate, updated.firstNightEnteredAt.slice(0, 10));
  assert.equal(updated.switchCount, 1);
});

test("recordNightSwitch treats invalid same-day counts as zero", () => {
  const now = "2026-07-12T22:00:00+08:00";

  for (const switchCount of [-1, 1.5, Infinity, "2", null, undefined]) {
    const updated = recordNightSwitch({ lastSwitchDate: "2026-07-12", switchCount }, now);
    assert.equal(updated.switchCount, 1);
  }
});

test("recordNightSwitch tolerates malformed archives without mutating its input", () => {
  const now = "2026-07-12T22:00:00+08:00";
  const archive = {
    firstNightEnteredAt: { invalid: true },
    lastSwitchDate: "2026-07-12",
    switchCount: 4,
    futureField: { enabled: true },
  };
  const original = structuredClone(archive);

  const updated = recordNightSwitch(archive, now);

  assert.notEqual(updated, archive);
  assert.deepEqual(archive, original);
  assert.equal(updated.firstNightEnteredAt, now);
  assert.equal(updated.switchCount, 5);
  assert.deepEqual(updated.futureField, { enabled: true });
  assert.deepEqual(recordNightSwitch(null, now), {
    firstNightEnteredAt: now,
    lastSwitchDate: "2026-07-12",
    switchCount: 1,
  });
});
