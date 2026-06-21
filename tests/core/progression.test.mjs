import test from "node:test";
import assert from "node:assert/strict";
import { applyExp, getLevelFromExp } from "../../src/core/progression.mjs";

test("getLevelFromExp uses slower growth at higher levels", () => {
  assert.equal(getLevelFromExp(0).value, 1);
  assert.ok(getLevelFromExp(1800).value > 10);
  assert.ok(getLevelFromExp(8000).value > getLevelFromExp(1800).value);
});

test("applyExp updates level progress", () => {
  const level = applyExp({ value: 1, exp: 0, nextLevelExp: 100 }, 140);

  assert.ok(level.exp >= 140);
  assert.ok(level.value >= 2);
  assert.ok(level.nextLevelExp > level.exp);
});
