import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("focused Earth keeps a slow living rotation and restores home speed", async () => {
  const source = await readFile(
    new URL("../../src/scene/earth-scene.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /const HOME_ROTATION_SPEED = 0\.045;/);
  assert.match(source, /const FOCUS_ROTATION_SPEED = 0\.012;/);
  assert.match(source, /rotationSpeed = FOCUS_ROTATION_SPEED;/);
  assert.match(source, /rotationSpeed = HOME_ROTATION_SPEED;/);
  assert.doesNotMatch(source, /idleRotation/);
});
