import { getLocalDateKey } from "./local-date.mjs";

export function getNightTransitionDuration(archive, dateKey, reducedMotion) {
  if (reducedMotion === true) {
    return 250;
  }

  const safeArchive = isObject(archive) ? archive : {};
  if (!isNonemptyString(safeArchive.firstNightEnteredAt)) {
    return 2400;
  }

  return safeArchive.lastSwitchDate === dateKey ? 700 : 1300;
}

export function recordNightSwitch(archive, now = new Date()) {
  const safeArchive = isObject(archive) ? archive : {};
  const timestamp = now instanceof Date ? now.toISOString() : now;
  const dateKey = getLocalDateKey(now);
  const sameDay = safeArchive.lastSwitchDate === dateKey;
  const count = isNonnegativeInteger(safeArchive.switchCount)
    ? safeArchive.switchCount
    : 0;

  return {
    ...safeArchive,
    firstNightEnteredAt: isNonemptyString(safeArchive.firstNightEnteredAt)
      ? safeArchive.firstNightEnteredAt
      : timestamp,
    lastSwitchDate: dateKey,
    switchCount: sameDay ? count + 1 : 1,
  };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}
