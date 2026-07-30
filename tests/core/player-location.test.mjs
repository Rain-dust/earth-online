import test from "node:test";
import assert from "node:assert/strict";
import {
  confirmPlayerLocation,
  formatPlayerLocation,
  normalizePlayerLocation,
  skipPlayerLocation,
} from "../../src/core/player-location.mjs";

const NOW = "2026-07-21T08:00:00.000Z";
const SHENZHEN = {
  id: "simplemaps:1566922272",
  countryCode: "CN",
  countryName: "China",
  countryDisplayName: "中国",
  regionCode: null,
  regionName: "Guangdong",
  regionDisplayName: "广东",
  cityName: "Shenzhen",
  cityDisplayName: "深圳",
  asciiName: "Shenzhen",
  latitude: 22.5431,
  longitude: 114.0579,
  population: 17_600_000,
  capitalType: "admin",
};

test("manual location confirmation stores only a normalized city anchor", () => {
  const result = confirmPlayerLocation({}, SHENZHEN, NOW);

  assert.equal(result.locationSetupStatus, "confirmed");
  assert.deepEqual(result.location, {
    ...SHENZHEN,
    precision: "city",
    source: "manual",
    confirmedByUser: true,
    confirmedAt: NOW,
  });
  assert.equal(result.query, undefined);
  assert.equal(formatPlayerLocation(result.location), "中国 · 广东 · 深圳");
});

test("skipping location does not retain an unconfirmed candidate", () => {
  assert.deepEqual(skipPlayerLocation({ locationCandidate: SHENZHEN }), {
    locationSetupStatus: "skipped",
  });
});

test("old and invalid location fields safely normalize without inventing coordinates", () => {
  assert.deepEqual(normalizePlayerLocation(undefined), {
    location: null,
    locationSetupStatus: "unseen",
  });
  assert.deepEqual(normalizePlayerLocation({
    locationSetupStatus: "confirmed",
    location: { ...SHENZHEN, latitude: 200 },
  }), {
    location: null,
    locationSetupStatus: "unseen",
  });
});
