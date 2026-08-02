import { normalizeRuntimeStatus } from "./constants.mjs";
import { DAILY_MISSION_CATALOG } from "./daily-mission-catalog.mjs";

const SAFE_FALLBACK = Object.freeze({
  id: "safe-pause-two",
  title: "离开屏幕，活动 2 分钟。",
  content: "离开屏幕，活动 2 分钟。",
  maxMinutes: 2,
  systemHint: "短暂离开不会中断地球运行。",
  reward: {
    sourceId: "daily:safe-pause-two",
    primaryAttribute: "vitality",
    changes: { vitality: 1 },
    effect: {
      id: "buffered",
      name: "缓冲",
      description: "期间体力小幅提升。",
      durationMinutes: 45,
    },
  },
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
  const systemItems = DAILY_MISSION_CATALOG
    .filter((item) => item.statuses.includes(safeStatus))
    .map((item) => ({ ...item, source: "system" }));
  const customItems = normalizeCustomItems(preferences?.customItems, safeStatus);
  const eligibleSystemItems = systemItems
    .filter((item) => !excluded.has(item.id));
  const eligibleCustomItems = customItems
    .filter((item) => !excluded.has(item.id));
  const eligible = eligibleCustomItems.length > 0
    ? eligibleCustomItems
    : eligibleSystemItems;
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
    presentedAt: null,
    acceptedAt: null,
    skippedAt: null,
    content: selected.content || selected.title,
    systemHint: selected.systemHint || null,
    reward: selected.reward ? structuredCloneSafe(selected.reward) : null,
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
    .slice(0, 14)
    .map((run) => run?.maintenance?.itemId)
    .filter(Boolean);
}

function structuredCloneSafe(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
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
