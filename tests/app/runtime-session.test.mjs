import test from "node:test";
import assert from "node:assert/strict";
import {
  captureConnectionSnapshot,
  markBroadcastShown,
} from "../../src/app/runtime-session.mjs";

test("connection snapshot preserves the previous activity time without mutation", () => {
  const save = {
    connection: {
      firstConnectedAt: "2026-07-18T08:00:00.000Z",
      lastActiveAt: "2026-07-19T09:00:00.000Z",
      lastBroadcastAt: "2026-07-19T09:00:00.000Z",
    },
  };
  const before = structuredClone(save);

  assert.deepEqual(captureConnectionSnapshot(save), {
    previousLastActiveAt: "2026-07-19T09:00:00.000Z",
  });
  assert.deepEqual(save, before);
});

test("broadcast shown writes both activity timestamps only to a new save", () => {
  const save = {
    connection: {
      firstConnectedAt: null,
      lastActiveAt: "2026-07-19T09:00:00.000Z",
      lastBroadcastAt: null,
      futureField: "preserved",
    },
  };
  const shownAt = "2026-07-20T12:00:00.000Z";
  const next = markBroadcastShown(save, shownAt);

  assert.deepEqual(next.connection, {
    firstConnectedAt: shownAt,
    lastActiveAt: shownAt,
    lastBroadcastAt: shownAt,
    futureField: "preserved",
  });
  assert.equal(save.connection.lastActiveAt, "2026-07-19T09:00:00.000Z");
  assert.equal(save.connection.lastBroadcastAt, null);
});
