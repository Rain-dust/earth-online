export const WORLD_POPULATION_BASELINE = Object.freeze({
  value: 8_141_808_945,
  timestampMs: Date.UTC(2024, 6, 1, 0, 0, 0),
  annualGrowthRate: 0.0086,
  source: "World Bank WLD SP.POP.TOTL 2024, accessed during design research",
});

export function estimatePopulation({
  nowMs = Date.now(),
  baseline = WORLD_POPULATION_BASELINE,
} = {}) {
  const elapsedYears = Math.max(0, nowMs - baseline.timestampMs) / (365.2425 * 24 * 60 * 60 * 1000);
  const estimated = baseline.value * Math.pow(1 + baseline.annualGrowthRate, elapsedYears);
  return Math.floor(estimated);
}

export function formatPopulation(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
