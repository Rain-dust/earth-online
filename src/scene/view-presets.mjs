export const VIEW_PRESET_NAMES = Object.freeze([
  "home",
  "connection",
  "onboarding",
  "location-focus",
  "broadcast",
  "quiet",
]);

const PRESETS = Object.freeze({
  home: preset([0, 42, 285], [0, 56, 330], 900, 0.045),
  connection: preset([38, 18, 172], [34, 30, 212], 1350, 0.012),
  onboarding: preset([34, 20, 184], [30, 32, 222], 650, 0.012),
  "location-focus": preset([30, 14, 185], [27, 28, 218], 950, 0),
  broadcast: preset([38, 18, 178], [34, 30, 216], 720, 0.009),
  quiet: preset([16, 28, 218], [14, 42, 262], 850, 0.018),
});

const INITIAL_FRAME_CANDIDATES = Object.freeze([
  initialCandidate("asia", 30, 110),
  initialCandidate("americas", 18, -85),
  initialCandidate("africa-eurasia", 27, 25),
]);

export function getViewPreset(name, { aspect = 1 } = {}) {
  const selected = PRESETS[name] ?? PRESETS.onboarding;
  if (aspect >= 0.82) {
    return selected;
  }
  return Object.freeze({ ...selected, camera: selected.portraitCamera });
}

export function selectBestLitInitialPreset(date = new Date(), { aspect = 1 } = {}) {
  const solar = getSubsolarPoint(date);
  const selected = INITIAL_FRAME_CANDIDATES.reduce((best, candidate) => {
    const illumination = solarAltitudeScore(candidate, solar);
    return !best || illumination > best.illumination
      ? { ...candidate, illumination }
      : best;
  }, null);
  const distance = aspect < 0.82 ? 330 : 285;
  return Object.freeze({
    ...selected,
    camera: Object.freeze(cameraForLocation(selected.latitude, selected.longitude, distance)),
  });
}

export function getSubsolarPoint(date = new Date()) {
  const instant = date instanceof Date ? date : new Date(date);
  if (!Number.isFinite(instant.getTime())) {
    throw new TypeError("date must identify a valid instant");
  }

  const dayStart = Date.UTC(instant.getUTCFullYear(), 0, 0);
  const day = (instant.getTime() - dayStart) / 86_400_000;
  const declination = -23.44 * Math.cos(((day + 10) * Math.PI * 2) / 365.2422);
  const utcHours = instant.getUTCHours()
    + instant.getUTCMinutes() / 60
    + instant.getUTCSeconds() / 3600;
  const longitude = normalizeLongitude(180 - utcHours * 15);
  return Object.freeze({ latitude: declination, longitude });
}

function preset(camera, portraitCamera, duration, rotationSpeed) {
  return Object.freeze({
    camera: Object.freeze(camera),
    portraitCamera: Object.freeze(portraitCamera),
    duration,
    rotationSpeed,
  });
}

function initialCandidate(name, latitude, longitude) {
  return Object.freeze({ name, latitude, longitude });
}

function solarAltitudeScore(location, solar) {
  const latitude = degreesToRadians(location.latitude);
  const solarLatitude = degreesToRadians(solar.latitude);
  const longitudeDelta = degreesToRadians(location.longitude - solar.longitude);
  return Math.sin(latitude) * Math.sin(solarLatitude)
    + Math.cos(latitude) * Math.cos(solarLatitude) * Math.cos(longitudeDelta);
}

function cameraForLocation(latitude, longitude, distance) {
  const latitudeRadians = degreesToRadians(latitude);
  const longitudeRadians = degreesToRadians(longitude);
  const horizontal = distance * Math.cos(latitudeRadians);
  return [
    horizontal * Math.sin(longitudeRadians),
    distance * Math.sin(latitudeRadians),
    horizontal * Math.cos(longitudeRadians),
  ];
}

function normalizeLongitude(longitude) {
  return ((longitude + 180) % 360 + 360) % 360 - 180;
}

function degreesToRadians(value) {
  return (value * Math.PI) / 180;
}
