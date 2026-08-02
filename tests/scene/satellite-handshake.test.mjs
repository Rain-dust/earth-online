import test from "node:test";
import assert from "node:assert/strict";
import {
  createSatelliteHandshake,
  HANDSHAKE_TIMINGS,
} from "../../src/scene/satellite-handshake.mjs";

const LOCATION = Object.freeze({ latitude: 31.23, longitude: 121.47 });

test("handshake timings keep entry and restore inside their budgets", () => {
  assert.ok(HANDSHAKE_TIMINGS.entry.completeAt <= 3500);
  assert.ok(HANDSHAKE_TIMINGS.entry.awakeAt <= 3000);
  assert.ok(HANDSHAKE_TIMINGS.restore.completeAt <= 2600);
});

test("reduced motion preserves the complete handshake state without timers", async () => {
  const events = [];
  const handshake = createSatelliteHandshake({
    focusLocation: (_location, options) => events.push(["focus", options.duration]),
    onAcquireSatellite: ({ animated }) => events.push(["satellite", animated]),
    onAnchorState: (state) => events.push(["anchor", state]),
    onDownlink: ({ animated }) => events.push(["downlink", animated]),
    onReturnPulse: ({ animated }) => events.push(["return", animated]),
    onComplete: () => events.push(["complete"]),
  });

  const result = await handshake.establishPlayerSignal(LOCATION, {
    reducedMotion: true,
    mode: "restore",
  });

  assert.deepEqual(result, { status: "completed", mode: "restore" });
  assert.deepEqual(events, [
    ["satellite", false],
    ["anchor", "acquiring"],
    ["focus", 720],
    ["downlink", false],
    ["anchor", "awake"],
    ["return", false],
    ["complete"],
  ]);
});

test("a duplicate handshake safely supersedes the active sequence", async () => {
  const cancellations = [];
  const handshake = createSatelliteHandshake({
    onCancel: ({ status }) => cancellations.push(status),
  });

  const first = handshake.establishPlayerSignal(LOCATION);
  const second = handshake.establishPlayerSignal(LOCATION, { reducedMotion: true });

  assert.deepEqual(await first, { status: "superseded", mode: "entry" });
  assert.deepEqual(await second, { status: "completed", mode: "entry" });
  assert.deepEqual(cancellations, ["superseded"]);
});
