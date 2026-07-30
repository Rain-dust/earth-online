import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import {
  buildLocationRecords,
  selectLocationSourceRecords,
} from "../../scripts/build-location-index.mjs";

const SOURCE = [
  city("1", "Alpha", "AA", 900_000, "", "North", 10, 20),
  city("2", "Beta", "AA", 80_000, "primary", "North", 11, 21),
  city("3", "Gamma", "AA", 70_000, "admin", "South", 12, 22),
  city("4", "Delta", "AA", 60_000, "", "South", 13, 23),
  city("5", "Epsilon", "AA", 50_000, "", "South", 14, 24),
  city("6", "Zeta", "AA", 40_000, "", "South", 15, 25),
  city("7", "Eta", "AA", 30_000, "", "South", 16, 26),
  city("8", "Theta", "AA", 20_000, "", "South", 17, 27),
  city("9", "Iota", "AA", 10_000, "", "South", 18, 28),
  city("10", "Kappa", "AA", 9_000, "", "South", 19, 29),
  city("11", "Onlytown", "BB", 2_000, "", "Island", -10, 40),
  city("12", "Springfield", "US", 120_000, "", "Illinois", 39.78, -89.64),
  city("13", "Springfield", "US", 170_000, "", "Missouri", 37.21, -93.29),
  city("bad", "Broken", "US", 500_000, "", "Nowhere", 140, 400),
];

test("location selection keeps large, capital, admin and country top-eight cities", () => {
  const selected = selectLocationSourceRecords(SOURCE);
  const ids = new Set(selected.map((item) => item.id));

  assert.ok(ids.has("1"));
  assert.ok(ids.has("2"));
  assert.ok(ids.has("3"));
  assert.ok(ids.has("8"));
  assert.ok(!ids.has("9"));
  assert.ok(!ids.has("10"));
  assert.ok(ids.has("11"));
  assert.ok(!ids.has("bad"));
});

test("location records use valid stable IDs and distinguish same-name cities", () => {
  const records = buildLocationRecords(SOURCE, { displayNames: false });
  const springfields = records.filter((item) => item.cityName === "Springfield");

  assert.equal(new Set(records.map((item) => item.id)).size, records.length);
  assert.deepEqual(springfields.map((item) => item.id), ["simplemaps:12", "simplemaps:13"]);
  assert.deepEqual(springfields.map((item) => item.regionName), ["Illinois", "Missouri"]);
  assert.ok(records.every((item) => item.latitude >= -90 && item.latitude <= 90));
  assert.ok(records.every((item) => item.longitude >= -180 && item.longitude <= 180));
});

test("location generation is stable regardless of source ordering", () => {
  assert.deepEqual(
    buildLocationRecords(SOURCE, { displayNames: false }),
    buildLocationRecords([...SOURCE].reverse(), { displayNames: false }),
  );
});

test("location data attribution file exists and names CC BY 4.0", async () => {
  const licenseUrl = new URL("../../assets/data/LOCATION_DATA_LICENSE.md", import.meta.url);
  await access(licenseUrl);
  const license = await readFile(licenseUrl, "utf8");
  assert.match(license, /JetSetExpert\/cities-json/);
  assert.match(license, /CC BY 4\.0/);
});

function city(id, name, iso2, population, capital, adminName, lat, lng) {
  return {
    id,
    city: name,
    city_ascii: name,
    country: `Country ${iso2}`,
    iso2,
    admin_name: adminName,
    capital,
    population: String(population),
    lat: String(lat),
    lng: String(lng),
  };
}
