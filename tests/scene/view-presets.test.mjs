import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getViewPreset,
  selectBestLitInitialPreset,
  VIEW_PRESET_NAMES,
} from "../../src/scene/view-presets.mjs";

test("view presets cover the v0.4 runtime states without exposing mutable camera values", () => {
  assert.deepEqual(VIEW_PRESET_NAMES, ["home", "connection", "onboarding", "location-focus", "broadcast", "quiet"]);
  const location = getViewPreset("location-focus");
  assert.ok(location.camera[2] >= 170);
  assert.ok(Object.isFrozen(location));
  assert.notStrictEqual(getViewPreset("onboarding"), getViewPreset("location-focus"));
});

test("unknown view preset safely falls back to onboarding", () => {
  assert.deepEqual(getViewPreset("unknown"), getViewPreset("onboarding"));
});

test("portrait presets pull the camera back without changing timing", () => {
  const landscape = getViewPreset("location-focus", { aspect: 1.6 });
  const portrait = getViewPreset("location-focus", { aspect: 0.6 });

  assert.ok(vectorLength(portrait.camera) > vectorLength(landscape.camera));
  assert.equal(portrait.duration, landscape.duration);
  assert.equal(portrait.rotationSpeed, landscape.rotationSpeed);
});

test("initial framing deterministically selects a currently lit land region", () => {
  const asiaMorning = selectBestLitInitialPreset("2026-06-21T04:00:00.000Z");
  const europeNoon = selectBestLitInitialPreset("2026-06-21T12:00:00.000Z");

  assert.equal(asiaMorning.name, "asia");
  assert.equal(europeNoon.name, "africa-eurasia");
  assert.ok(asiaMorning.illumination > 0);
  assert.deepEqual(
    selectBestLitInitialPreset("2026-06-21T04:00:00.000Z"),
    asiaMorning,
  );
});

test("location focus derives its distance from the destination camera preset", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /getViewPreset\("location-focus", \{ aspect: camera\.aspect \}\)/);
  assert.match(source, /multiplyScalar\(new THREE\.Vector3\(\.\.\.locationPreset\.camera\)\.length\(\)\)/);
});

function vectorLength(vector) {
  return Math.hypot(...vector);
}
