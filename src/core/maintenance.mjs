import {
  MAINTENANCE_CATALOG,
  normalizeRuntimeStatus,
} from "./constants.mjs";

const SAFE_FALLBACK = Object.freeze({
  id: "safe-pause-two",
  title: "离开屏幕，活动 2 分钟",
  maxMinutes: 2,
});

export function selectMaintenance({
  date,
  status,
  recentRuns = [],
  preferences = {},
  excludedToday = [],
} = {}) {
  const safeStatus = normalizeRuntimeStatus(status);
  const excluded = new Set([
    ...asStringArray(preferences?.excludedIds),
    ...asStringArray(excludedToday),
    ...getRecentItemIds(recentRuns, date),
  ]);
  const systemItems = MAINTENANCE_CATALOG
    .filter((item) => item.statuses.includes(safeStatus))
    .map((item) => ({ ...item, source: "system" }));
  const customItems = normalizeCustomItems(preferences?.customItems, safeStatus);
  const eligible = [...systemItems, ...customItems]
    .filter((item) => !excluded.has(item.id));
  const selected = eligible.length > 0
    ? eligible[hash(`${date || "undated"}:${safeStatus}`) % eligible.length]
    : { ...SAFE_FALLBACK, source: "fallback" };

  return {
    itemId: selected.id,
    title: selected.title,
    status: safeStatus,
    source: selected.source,
    maxMinutes: selected.maxMinutes,
    replacementCount: 0,
    replacedFrom: null,
    completedAt: null,
  };
}

export function replaceMaintenance(current, context = {}) {
  if (!current || Number(current.replacementCount) >= 1) {
    return current;
  }

  const next = selectMaintenance({
    ...context,
    excludedToday: [
      ...asStringArray(context.excludedToday),
      current.itemId,
      current.replacedFrom,
    ],
  });

  return {
    ...next,
    replacementCount: 1,
    replacedFrom: current.itemId,
  };
}

function normalizeCustomItems(value, status) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const title = typeof item?.title === "string" ? item.title.trim() : "";
    const statuses = Array.isArray(item?.statuses)
      ? item.statuses.map(normalizeRuntimeStatus)
      : [];

    if (!id || !title || (statuses.length > 0 && !statuses.includes(status))) {
      return [];
    }

    return [{
      id,
      title,
      maxMinutes: Math.min(20, Math.max(1, Math.round(Number(item.maxMinutes) || 10))),
      source: "custom",
    }];
  });
}

function getRecentItemIds(value, currentDate) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((run) => typeof run?.date === "string" && run.date < currentDate)
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 3)
    .map((run) => run?.maintenance?.itemId)
    .filter(Boolean);
}

function asStringArray(value) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === "string" && item)
    : [];
}

function hash(value) {
  let result = 0;

  for (const char of String(value)) {
    result = (result * 31 + char.charCodeAt(0)) >>> 0;
  }

  return result;
}
