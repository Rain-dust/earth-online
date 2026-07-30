const DEFAULT_LOCATION_INDEX_URL = "./assets/data/earth-online-locations.v1.json";

export function createCompactLocationIndex(locations) {
  const countries = [];
  const regions = [];
  const countryIndexes = new Map();
  const regionIndexes = new Map();

  const compactLocations = (Array.isArray(locations) ? locations : []).map((location) => {
    const countryKey = [location.countryCode, location.countryName, location.countryDisplayName].join("\u0000");
    let countryIndex = countryIndexes.get(countryKey);
    if (countryIndex === undefined) {
      countryIndex = countries.length;
      countryIndexes.set(countryKey, countryIndex);
      countries.push([location.countryCode, location.countryName, location.countryDisplayName]);
    }

    let regionIndex = -1;
    if (location.regionName) {
      const regionKey = [
        countryIndex,
        location.regionCode || "",
        location.regionName,
        location.regionDisplayName || "",
      ].join("\u0000");
      regionIndex = regionIndexes.get(regionKey);
      if (regionIndex === undefined) {
        regionIndex = regions.length;
        regionIndexes.set(regionKey, regionIndex);
        regions.push([
          countryIndex,
          location.regionCode,
          location.regionName,
          location.regionDisplayName,
        ]);
      }
    }

    return [
      location.id,
      countryIndex,
      regionIndex,
      location.cityName,
      location.cityDisplayName,
      location.asciiName,
      location.latitude,
      location.longitude,
      location.population,
      location.capitalType,
    ];
  });

  return { version: 1, countries, regions, locations: compactLocations };
}

export function expandLocationIndex(index) {
  if (!isValidIndex(index)) throw new Error("地点索引格式无效");

  return index.locations.map((entry) => {
    const [
      id, countryIndex, regionIndex, cityName, cityDisplayName, asciiName,
      latitude, longitude, population, capitalType,
    ] = entry;
    const country = index.countries[countryIndex];
    const region = regionIndex >= 0 ? index.regions[regionIndex] : null;

    return {
      id,
      countryCode: country[0],
      countryName: country[1],
      countryDisplayName: country[2],
      regionCode: region?.[1] ?? null,
      regionName: region?.[2] ?? null,
      regionDisplayName: region?.[3] ?? null,
      cityName,
      cityDisplayName,
      asciiName,
      latitude,
      longitude,
      population,
      capitalType,
    };
  });
}

export async function loadLocationIndex({
  url = DEFAULT_LOCATION_INDEX_URL,
  fetchImpl = globalThis.fetch,
  signal,
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("地点索引加载失败：本地读取能力不可用");

  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new Error(`地点索引加载失败：${error?.message || "未知错误"}`);
  }

  if (!response?.ok) throw new Error(`地点索引加载失败：HTTP ${response?.status || "unknown"}`);

  try {
    return expandLocationIndex(await response.json());
  } catch (error) {
    if (error?.message === "地点索引格式无效") throw error;
    throw new Error("地点索引格式无效");
  }
}

function isValidIndex(index) {
  if (index?.version !== 1) return false;
  if (!Array.isArray(index.countries) || !Array.isArray(index.regions) || !Array.isArray(index.locations)) return false;
  if (!index.countries.every((entry) => Array.isArray(entry) && entry.length >= 3)) return false;
  if (!index.regions.every((entry) => Array.isArray(entry) && entry.length >= 4 && index.countries[entry[0]])) return false;

  return index.locations.every((entry) => {
    if (!Array.isArray(entry) || entry.length < 10) return false;
    const [, countryIndex, regionIndex, , , , latitude, longitude] = entry;
    return Boolean(index.countries[countryIndex])
      && (regionIndex === -1 || Boolean(index.regions[regionIndex]))
      && Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
      && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  });
}
