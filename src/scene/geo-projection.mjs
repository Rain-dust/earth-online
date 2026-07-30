export function latLngToCartesian(latitude, longitude, radius = 1) {
  const lat = toFiniteNumber(latitude, "latitude");
  const lng = toFiniteNumber(longitude, "longitude");
  const globeRadius = toFiniteNumber(radius, "radius");
  const latRadians = (lat * Math.PI) / 180;
  const lngRadians = (lng * Math.PI) / 180;
  const horizontal = globeRadius * Math.cos(latRadians);

  return {
    x: normalizeZero(horizontal * Math.sin(lngRadians)),
    y: normalizeZero(globeRadius * Math.sin(latRadians)),
    z: normalizeZero(horizontal * Math.cos(lngRadians)),
  };
}

function normalizeZero(value) {
  return Object.is(value, -0) ? 0 : value;
}

export function isWorldPointVisible(point, cameraPosition) {
  const pointLength = Math.hypot(point.x, point.y, point.z);
  if (!Number.isFinite(pointLength) || pointLength === 0) {
    return false;
  }

  const toCamera = {
    x: cameraPosition.x - point.x,
    y: cameraPosition.y - point.y,
    z: cameraPosition.z - point.z,
  };

  return point.x * toCamera.x + point.y * toCamera.y + point.z * toCamera.z > 0;
}

export function isProjectedPointVisible(projected) {
  return Number.isFinite(projected.x)
    && Number.isFinite(projected.y)
    && Number.isFinite(projected.z)
    && projected.x >= -1
    && projected.x <= 1
    && projected.y >= -1
    && projected.y <= 1
    && projected.z >= -1
    && projected.z <= 1;
}

function toFiniteNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new TypeError(`${label} must be a finite number`);
  }
  return number;
}
