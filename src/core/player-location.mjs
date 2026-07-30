const LOCATION_SETUP_STATUSES = new Set(["unseen", "confirmed", "skipped"]);

export function confirmPlayerLocation(profile = {}, location, confirmedAt = new Date().toISOString()) {
  const normalized = normalizeLocationRecord(location);
  if (!normalized) throw new Error("请选择一个有效的城市位置");
  if (!isValidTimestamp(confirmedAt)) throw new Error("位置确认时间无效");

  return {
    ...withoutTransientLocationFields(profile),
    location: {
      ...normalized,
      precision: "city",
      source: "manual",
      confirmedByUser: true,
      confirmedAt,
    },
    locationSetupStatus: "confirmed",
  };
}

export function skipPlayerLocation(profile = {}) {
  return {
    ...withoutTransientLocationFields(profile),
    locationSetupStatus: "skipped",
  };
}

export function normalizePlayerLocation(profile = {}) {
  const requestedStatus = LOCATION_SETUP_STATUSES.has(profile?.locationSetupStatus)
    ? profile.locationSetupStatus
    : "unseen";
  const location = normalizeConfirmedLocation(profile?.location);

  if (requestedStatus === "confirmed" && location) {
    return { location, locationSetupStatus: "confirmed" };
  }

  return {
    location: null,
    locationSetupStatus: requestedStatus === "skipped" ? "skipped" : "unseen",
  };
}

export function formatPlayerLocation(location) {
  const normalized = normalizeConfirmedLocation(location);
  return formatNormalizedLocation(normalized);
}

export function formatLocationRecord(location) {
  return formatNormalizedLocation(normalizeLocationRecord(location));
}

function formatNormalizedLocation(normalized) {
  if (!normalized) return "";

  return [
    normalized.countryDisplayName || normalized.countryName,
    normalized.regionDisplayName || normalized.regionName,
    normalized.cityDisplayName || normalized.cityName,
  ].filter(Boolean).join(" · ");
}

function normalizeConfirmedLocation(value) {
  if (value?.source !== "manual" || value?.precision !== "city" || value?.confirmedByUser !== true) {
    return null;
  }
  if (!isValidTimestamp(value.confirmedAt)) return null;

  const location = normalizeLocationRecord(value);
  return location ? {
    ...location,
    precision: "city",
    source: "manual",
    confirmedByUser: true,
    confirmedAt: value.confirmedAt,
  } : null;
}

function normalizeLocationRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const id = String(value.id || "").trim();
  const countryCode = String(value.countryCode || "").trim().toUpperCase();
  const countryName = String(value.countryName || "").trim();
  const cityName = String(value.cityName || "").trim();

  if (!id || !/^[A-Z]{2}$/.test(countryCode) || !countryName || !cityName) return null;
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;

  return {
    id,
    countryCode,
    countryName,
    countryDisplayName: cleanOptional(value.countryDisplayName) || countryName,
    regionCode: cleanOptional(value.regionCode),
    regionName: cleanOptional(value.regionName),
    regionDisplayName: cleanOptional(value.regionDisplayName) || cleanOptional(value.regionName),
    cityName,
    cityDisplayName: cleanOptional(value.cityDisplayName) || cityName,
    asciiName: cleanOptional(value.asciiName) || cityName,
    latitude,
    longitude,
    population: normalizePopulation(value.population),
    capitalType: ["primary", "admin"].includes(value.capitalType) ? value.capitalType : null,
  };
}

function withoutTransientLocationFields(profile) {
  const { location, locationCandidate, query, ...rest } = profile && typeof profile === "object"
    ? profile
    : {};
  return rest;
}

function cleanOptional(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizePopulation(value) {
  const population = Number(value);
  return Number.isFinite(population) && population >= 0 ? Math.round(population) : null;
}

function isValidTimestamp(value) {
  return typeof value === "string" && value.trim() !== "" && Number.isFinite(Date.parse(value));
}
