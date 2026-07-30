import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("player signal anchor is a single reusable object with one-shot pulse and cleanup", async () => {
  const source = await readFile(new URL("../../src/scene/player-signal-anchor.mjs", import.meta.url), "utf8");

  assert.match(source, /PlayerSignalAnchor/);
  assert.match(source, /pulseOnce/);
  assert.match(source, /activePulse/);
  assert.match(source, /remove\(activePulse\.mesh\)/);
  assert.match(source, /dispose\(\)/);
  assert.doesNotMatch(source, /setInterval|repeat|Infinity/);
});

test("player signal anchor has explicit states, two warm rings, and a stable core", async () => {
  const source = await readFile(new URL("../../src/scene/player-signal-anchor.mjs", import.meta.url), "utf8");

  assert.match(source, /\["hidden", "acquiring", "awake"\]/);
  assert.match(source, /setState\(state, location\)/);
  assert.match(source, /secondMesh/);
  assert.match(source, /WARM_WHITE/);
  assert.match(source, /MICRO_GOLD/);
  assert.doesNotMatch(source, /core\.scale|this\.core\.scale/);
});

test("earth scene exposes location focus, projection subscription and anchor lifecycle", async () => {
  const source = await readFile(new URL("../../src/scene/earth-scene.mjs", import.meta.url), "utf8");

  assert.match(source, /focusLocation/);
  assert.match(source, /setPlayerLocation/);
  assert.match(source, /pulsePlayerSignal/);
  assert.match(source, /subscribeLocationProjection/);
  assert.match(source, /applyViewPreset/);
  assert.match(source, /applyInitialFraming/);
  assert.match(source, /establishPlayerSignal/);
  assert.match(source, /abortPlayerSignalHandshake/);
  assert.match(source, /prefersReducedMotion/);
  assert.match(source, /document\.hidden/);
});
