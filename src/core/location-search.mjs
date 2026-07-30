const DEFAULT_LIMIT = 8;

export function searchLocations(locations, query, {
  limit = DEFAULT_LIMIT,
  countryCode = "",
  regionName = "",
} = {}) {
  const needle = normalizeSearchText(query);
  if (!needle || !Array.isArray(locations)) return [];

  const maxResults = Number.isInteger(limit) && limit > 0 ? limit : DEFAULT_LIMIT;

  return locations
    .filter(isLocation)
    .filter((location) => !countryCode || location.countryCode === countryCode)
    .filter((location) => !regionName || location.regionName === regionName)
    .map((location) => ({ location, rank: getMatchRank(location, needle) }))
    .filter((candidate) => candidate.rank < 3)
    .sort(compareCandidates)
    .slice(0, maxResults)
    .map((candidate) => candidate.location);
}

export function getLocationCountries(locations) {
  const countries = new Map();

  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isLocation(location) || countries.has(location.countryCode)) continue;
    countries.set(location.countryCode, {
      code: location.countryCode,
      name: location.countryName,
      displayName: location.countryDisplayName || location.countryName,
    });
  }

  return [...countries.values()].sort((a, b) => a.code.localeCompare(b.code, "en"));
}

export function getLocationRegions(locations, countryCode) {
  const regions = new Map();

  for (const location of Array.isArray(locations) ? locations : []) {
    if (!isLocation(location) || location.countryCode !== countryCode || !location.regionName) continue;
    if (!regions.has(location.regionName)) {
      regions.set(location.regionName, {
        code: location.regionCode || null,
        name: location.regionName,
        displayName: location.regionDisplayName || location.regionName,
      });
    }
  }

  return [...regions.values()].sort((a, b) => (
    a.displayName.localeCompare(b.displayName, "zh-CN")
      || a.name.localeCompare(b.name, "en")
  ));
}

function getMatchRank(location, needle) {
  const fields = getSearchFields(location);
  if (fields.some((field) => field === needle)) return 0;
  if (fields.some((field) => field.startsWith(needle))) return 1;
  if (fields.some((field) => field.includes(needle))) return 2;
  return 3;
}

function compareCandidates(a, b) {
  return a.rank - b.rank
    || getCapitalRank(a.location.capitalType) - getCapitalRank(b.location.capitalType)
    || Number(b.location.population || 0) - Number(a.location.population || 0)
    || a.location.id.localeCompare(b.location.id, "en");
}

function getSearchFields(location) {
  return [
    location.cityName,
    location.cityDisplayName,
    location.asciiName,
    location.regionName,
    location.regionDisplayName,
    location.countryName,
    location.countryDisplayName,
    location.countryCode,
  ].map(normalizeSearchText).filter(Boolean);
}

function getCapitalRank(value) {
  if (value === "primary") return 0;
  if (value === "admin") return 1;
  return 2;
}

function isLocation(value) {
  return Boolean(value)
    && typeof value.id === "string"
    && value.id.trim() !== ""
    && typeof value.countryCode === "string"
    && typeof value.cityName === "string"
    && Number.isFinite(value.latitude)
    && value.latitude >= -90
    && value.latitude <= 90
    && Number.isFinite(value.longitude)
    && value.longitude >= -180
    && value.longitude <= 180;
}

function normalizeSearchText(value) {
  return String(value || "").trim().toLocaleLowerCase("en-US");
}
