export const FIRST_SIGNAL_RECORD_ID = "first-signal-once-impossible";
export const FIRST_SIGNAL_RECORD_SOURCE = "player_confirmed";
export const FIRST_SIGNAL_RECORD_IMAGE =
  "./assets/achievements/runtime/first-signal-once-impossible.png";

export function normalizeFirstSignalRecord(value) {
  const recovered = isObject(value) && value.status === "recovered";

  return {
    id: FIRST_SIGNAL_RECORD_ID,
    status: recovered ? "recovered" : "pending",
    source: FIRST_SIGNAL_RECORD_SOURCE,
    confirmedAt: recovered && isNonemptyString(value.confirmedAt)
      ? value.confirmedAt.trim()
      : null,
  };
}

export function getFirstSignalArchiveView(save) {
  const record = normalizeFirstSignalRecord(
    isObject(save?.achievementArchive)
      ? save.achievementArchive.firstSignalRecord
      : null,
  );

  return {
    record,
    id: record.id,
    status: record.status,
    recovered: record.status === "recovered",
    imageAsset: FIRST_SIGNAL_RECORD_IMAGE,
  };
}

export function confirmFirstSignalRecord(save, now = new Date()) {
  const safeSave = isObject(save) ? save : {};
  const archive = isObject(safeSave.achievementArchive)
    ? safeSave.achievementArchive
    : {};
  const current = normalizeFirstSignalRecord(archive.firstSignalRecord);

  if (current.status === "recovered" && isCanonicalRecord(archive.firstSignalRecord, current)) {
    return safeSave;
  }

  const record = current.status === "recovered"
    ? current
    : {
        ...current,
        status: "recovered",
        confirmedAt: normalizeTimestamp(now),
      };

  return {
    ...safeSave,
    achievementArchive: {
      ...archive,
      firstSignalRecord: record,
    },
  };
}

function normalizeTimestamp(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new TypeError("Invalid confirmation timestamp");
  }
  return date.toISOString();
}

function isCanonicalRecord(value, normalized) {
  return isObject(value)
    && Object.keys(value).length === 4
    && value.id === normalized.id
    && value.status === normalized.status
    && value.source === normalized.source
    && value.confirmedAt === normalized.confirmedAt;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonemptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
