import test from "node:test";
import assert from "node:assert/strict";
import {
  isProjectedPointVisible,
  isWorldPointVisible,
  latLngToCartesian,
} from "../../src/scene/geo-projection.mjs";

test("latitude and longitude convert to stable globe coordinates", () => {
  assert.deepEqual(round(latLngToCartesian(0, 0, 100)), { x: 0, y: 0, z: 100 });
  assert.deepEqual(round(latLngToCartesian(90, 0, 100)), { x: 0, y: 100, z: 0 });
  assert.deepEqual(round(latLngToCartesian(0, 90, 100)), { x: 100, y: 0, z: 0 });
});

test("visibility rejects globe points facing away from the camera", () => {
  assert.equal(isWorldPointVisible({ x: 0, y: 0, z: 100 }, { x: 0, y: 0, z: 280 }), true);
  assert.equal(isWorldPointVisible({ x: 0, y: 0, z: -100 }, { x: 0, y: 0, z: 280 }), false);
});

test("projected visibility includes both x and y viewport bounds", () => {
  assert.equal(isProjectedPointVisible({ x: 0.8, y: -0.9, z: 0.2 }), true);
  assert.equal(isProjectedPointVisible({ x: 1.01, y: 0, z: 0.2 }), false);
  assert.equal(isProjectedPointVisible({ x: 0, y: -1.01, z: 0.2 }), false);
  assert.equal(isProjectedPointVisible({ x: 0, y: 0, z: 1.01 }), false);
});

function round(point) {
  return Object.fromEntries(Object.entries(point).map(([key, value]) => [key, Math.round(value)]));
}
