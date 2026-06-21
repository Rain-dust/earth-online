import test from "node:test";
import assert from "node:assert/strict";
import { applyExp, getLevelFromExp } from "../../src/core/progression.mjs";

test("getLevelFromExp uses slower growth at higher levels", () => {
  assert.equal(getLevelFromExp(0).value, 1);
  assert.equal(getLevelFromExp(1800).value, 11);
  assert.equal(getLevelFromExp(8000).value, 23);
  assert.ok(getLevelFromExp(8000).value > getLevelFromExp(1800).value);
});

test("applyExp updates level progress", () => {
  const level = applyExp({ value: 1, exp: 0, nextLevelExp: 100 }, 140);

  assert.ok(level.exp >= 140);
  assert.ok(level.value >= 2);
  assert.ok(level.nextLevelExp > level.exp);
});

test("progression functions handle non-finite inputs safely", () => {
  const infiniteLevel = getLevelFromExp(Infinity);
  const nanLevel = getLevelFromExp(NaN);
  const gainedInfinity = applyExp({ value: 1, exp: 0, nextLevelExp: 16 }, Infinity);

  for (const level of [infiniteLevel, nanLevel, gainedInfinity]) {
    assert.equal(Number.isFinite(level.value), true);
    assert.equal(Number.isFinite(level.exp), true);
    assert.equal(Number.isFinite(level.nextLevelExp), true);
    assert.equal(Number.isFinite(level.progress), true);
  }

  assert.equal(nanLevel.value, 1);
  assert.equal(gainedInfinity.value, 1);
});
