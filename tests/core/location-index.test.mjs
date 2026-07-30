import test from "node:test";
import assert from "node:assert/strict";
import {
  createCompactLocationIndex,
  expandLocationIndex,
  loadLocationIndex,
} from "../../src/core/location-index.mjs";

const LOCATIONS = [
  {
    id: "simplemaps:1", countryCode: "CN", countryName: "China", countryDisplayName: "中国",
    regionCode: null, regionName: "Guangdong", regionDisplayName: "广东",
    cityName: "Shenzhen", cityDisplayName: "深圳", asciiName: "Shenzhen",
    latitude: 22.5431, longitude: 114.0579, population: 17_600_000, capitalType: "admin",
  },
  {
    id: "simplemaps:2", countryCode: "CN", countryName: "China", countryDisplayName: "中国",
    regionCode: null, regionName: "Guangdong", regionDisplayName: "广东",
    cityName: "Foshan", cityDisplayName: "佛山", asciiName: "Foshan",
    latitude: 23.0218, longitude: 113.1219, population: 9_500_000, capitalType: null,
  },
];

test("compact location index round-trips normalized records without repeated country fields", () => {
  const compact = createCompactLocationIndex(LOCATIONS);

  assert.equal(compact.version, 1);
  assert.equal(compact.countries.length, 1);
  assert.equal(compact.regions.length, 1);
  assert.deepEqual(expandLocationIndex(compact), LOCATIONS);
});

test("location index loader reports network and malformed data failures", async () => {
  await assert.rejects(
    loadLocationIndex({ fetchImpl: async () => ({ ok: false, status: 503 }) }),
    /地点索引加载失败/,
  );
  await assert.rejects(
    loadLocationIndex({ fetchImpl: async () => ({ ok: true, json: async () => ({ version: 99 }) }) }),
    /地点索引格式无效/,
  );
});

test("location index loader expands a valid local payload", async () => {
  const compact = createCompactLocationIndex(LOCATIONS);
  const loaded = await loadLocationIndex({
    fetchImpl: async () => ({ ok: true, json: async () => compact }),
  });

  assert.deepEqual(loaded, LOCATIONS);
});
