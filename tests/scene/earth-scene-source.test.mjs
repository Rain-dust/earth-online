import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("focused Earth keeps a slow living rotation and restores home speed", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /const HOME_ROTATION_SPEED = 0\.045;/);
  assert.match(source, /rotationSpeed = HOME_ROTATION_SPEED;/);
  assert.match(source, /preset\.rotationSpeed/);
  assert.doesNotMatch(source, /idleRotation/);
});

test("home fallback can synchronously clear night visuals and the rotation lock", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );
  const start = source.indexOf("function resetToDay()");
  const end = source.indexOf("function skipTransition()", start);
  const reset = source.slice(start, end);

  assert.match(reset, /targetVisualMode = "day"/);
  assert.match(reset, /nightRotationLocked = false/);
  assert.match(reset, /applyVisualState\(0, dayRotation \?\? earthGroup\.rotation\.y\)/);
  assert.match(source, /resetToDay,/);
});

test("camera presets ease rotation speed instead of switching it before the zoom", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );
  const presetStart = source.indexOf("function applyViewPreset(");
  const presetEnd = source.indexOf("function applyInitialFraming(", presetStart);
  const preset = source.slice(presetStart, presetEnd);
  const tweenStart = source.indexOf("function tweenCamera(");
  const tweenEnd = source.indexOf("function updateTween(", tweenStart);
  const tween = source.slice(tweenStart, tweenEnd);

  assert.doesNotMatch(preset, /rotationSpeed = preset\.rotationSpeed/);
  assert.match(preset, /preset\.rotationSpeed/);
  assert.match(tween, /fromRotationSpeed/);
  assert.match(tween, /targetRotationSpeed/);
});

test("connection zoom preserves the current viewing direction before location focus", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );
  const presetStart = source.indexOf("function applyViewPreset(");
  const presetEnd = source.indexOf("function applyInitialFraming(", presetStart);
  const preset = source.slice(presetStart, presetEnd);

  assert.match(preset, /name === "connection"/);
  assert.match(preset, /camera\.position\.clone\(\)\.normalize\(\)\.multiplyScalar\(presetCamera\.length\(\)\)/);
});

test("reduced motion keeps camera changes continuous instead of teleporting", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /const REDUCED_CAMERA_DURATION = 600;/);
  assert.match(
    source,
    /reducedMotion\s*\? Math\.min\(duration \?\? preset\.duration, REDUCED_CAMERA_DURATION\)/,
  );
  assert.match(
    source,
    /reducedMotion\s*\? Math\.min\(duration \?\? locationPreset\.duration, REDUCED_CAMERA_DURATION\)/,
  );
  assert.doesNotMatch(source, /reducedMotion \? 0 : \(duration \?\? preset\.duration\)/);
  assert.doesNotMatch(source, /reducedMotion \? 0 : \(duration \?\? locationPreset\.duration\)/);
});

test("location focus orbits around Earth instead of cutting through the globe", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );
  const tweenStart = source.indexOf("function tweenCamera(");
  const tweenEnd = source.indexOf("function startVisualTween(", tweenStart);
  const tween = source.slice(tweenStart, tweenEnd);

  assert.match(tween, /setFromUnitVectors\(fromDirection, targetDirection\)/);
  assert.match(tween, /slerp\(activeTween\.turnQuaternion, eased\)/);
  assert.match(tween, /fromDistance/);
  assert.match(tween, /targetDistance/);
  assert.doesNotMatch(tween, /camera\.position\.lerpVectors/);
});

test("signal acquisition temporarily restores atmosphere and ocean liveliness", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /connectionLivelinessActive \|\| handshakeLivelinessActive \? 1 : 0/);
  assert.match(source, /setConnectionLiveliness\(true\)/);
  assert.match(source, /setConnectionLiveliness\(false\)/);
  assert.match(source, /updateSignalLiveliness\(ambientDelta\)/);
  assert.match(source, /signalLiveliness \* 0\.42/);
  assert.match(source, /onActiveChange\?\.\(true\)/);
  assert.match(source, /onActiveChange\?\.\(false\)/);
});
