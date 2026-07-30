import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocationCountries,
  getLocationRegions,
  searchLocations,
} from "../../src/core/location-search.mjs";

const LOCATIONS = [
  location("cn-shenzhen", "CN", "China", "中国", "Guangdong", "广东", "Shenzhen", "深圳", 17_600_000, "admin"),
  location("us-springfield-il", "US", "United States", "美国", "Illinois", "Illinois", "Springfield", "Springfield", 114_000, null),
  location("us-springfield-mo", "US", "United States", "美国", "Missouri", "Missouri", "Springfield", "Springfield", 170_000, null),
  location("jp-tokyo", "JP", "Japan", "日本", "Tokyo", "Tokyo", "Tokyo", "Tokyo", 37_000_000, "primary"),
];

test("location search supports exact, prefix, partial, ASCII and case-insensitive matching", () => {
  assert.equal(searchLocations(LOCATIONS, "深圳")[0].id, "cn-shenzhen");
  assert.equal(searchLocations(LOCATIONS, "shen")[0].id, "cn-shenzhen");
  assert.equal(searchLocations(LOCATIONS, "GUANG")[0].id, "cn-shenzhen");
  assert.equal(searchLocations(LOCATIONS, "china")[0].id, "cn-shenzhen");
});

test("location search is stable, limits results and preserves duplicate city identities", () => {
  const results = searchLocations(LOCATIONS, "spring", { limit: 1 });
  assert.equal(results.length, 1);
  assert.equal(results[0].id, "us-springfield-mo");
  assert.deepEqual(searchLocations(LOCATIONS, "spring").map((item) => item.id), [
    "us-springfield-mo",
    "us-springfield-il",
  ]);
});

test("location search returns empty for empty, missing and invalid indexes", () => {
  assert.deepEqual(searchLocations(LOCATIONS, ""), []);
  assert.deepEqual(searchLocations([], "Tokyo"), []);
  assert.deepEqual(searchLocations([{ cityName: "Broken" }], "Broken"), []);
});

test("country and region choices are unique and deterministically sorted", () => {
  assert.deepEqual(getLocationCountries(LOCATIONS).map((item) => item.code), ["CN", "JP", "US"]);
  assert.deepEqual(
    getLocationRegions(LOCATIONS, "US").map((item) => item.name),
    ["Illinois", "Missouri"],
  );
});

function location(id, countryCode, countryName, countryDisplayName, regionName, regionDisplayName, cityName, cityDisplayName, population, capitalType) {
  return {
    id,
    countryCode,
    countryName,
    countryDisplayName,
    regionCode: null,
    regionName,
    regionDisplayName,
    cityName,
    cityDisplayName,
    asciiName: cityName,
    latitude: 1,
    longitude: 1,
    population,
    capitalType,
  };
}
