import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocalDateKey,
  getLocalWeekRange,
} from "../../src/core/local-date.mjs";

test("getLocalDateKey uses calendar fields instead of UTC slicing", () => {
  const local = new Date(2026, 6, 13, 23, 58, 0);

  assert.equal(getLocalDateKey(local), "2026-07-13");
});

test("getLocalWeekRange returns Monday through Sunday", () => {
  const thursday = new Date(2026, 6, 16, 12, 0, 0);

  assert.deepEqual(getLocalWeekRange(thursday), {
    key: "2026-07-13",
    start: "2026-07-13",
    end: "2026-07-19",
  });
});

test("local calendar helpers reject invalid dates", () => {
  assert.throws(() => getLocalDateKey("not-a-date"), /Invalid calendar date/);
  assert.throws(() => getLocalWeekRange(new Date(Number.NaN)), /Invalid calendar date/);
});
