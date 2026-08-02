export function captureConnectionSnapshot(save = {}) {
  return {
    previousLastActiveAt: normalizeOptionalTimestamp(save?.connection?.lastActiveAt),
  };
}

export function markBroadcastShown(save = {}, shownAt = new Date().toISOString()) {
  return {
    ...save,
    connection: {
      ...(save?.connection || {}),
      firstConnectedAt: save?.connection?.firstConnectedAt || shownAt,
      lastActiveAt: shownAt,
      lastBroadcastAt: shownAt,
    },
  };
}

function normalizeOptionalTimestamp(value) {
  return typeof value === "string" && value.trim() ? value : null;
}
