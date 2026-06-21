import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_POPULATION_BASELINE,
  estimatePopulation,
  formatPopulation,
} from "../../src/core/population.mjs";

test("estimatePopulation returns baseline at baseline timestamp", () => {
  const value = estimatePopulation({
    nowMs: WORLD_POPULATION_BASELINE.timestampMs,
    baseline: WORLD_POPULATION_BASELINE,
  });

  assert.equal(value, WORLD_POPULATION_BASELINE.value);
});

test("estimatePopulation increases after time passes", () => {
  const value = estimatePopulation({
    nowMs: WORLD_POPULATION_BASELINE.timestampMs + 86_400_000,
    baseline: WORLD_POPULATION_BASELINE,
  });

  assert.ok(value > WORLD_POPULATION_BASELINE.value);
});

test("formatPopulation uses grouped digits", () => {
  assert.equal(formatPopulation(8141808945), "8,141,808,945");
});
