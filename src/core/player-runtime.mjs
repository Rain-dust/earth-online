import { getLocalWeekRange } from "./local-date.mjs";

export const PLAYER_ATTRIBUTE_DEFINITIONS = Object.freeze([
  attribute("vitality", "体力", "VITALITY", 65),
  attribute("energy", "精力", "ENERGY", 60),
  attribute("focus", "专注", "FOCUS", 55),
  attribute("mood", "心境", "MOOD", 60),
  attribute("order", "秩序", "ORDER", 50),
  attribute("connection", "连接", "CONNECTION", 50),
  attribute("exploration", "探索", "EXPLORATION", 50),
]);

export const PLAYER_RUNTIME_VERSION = 1;
export const DEFAULT_EFFECT_MINUTES = 45;
export const MAX_ACTIVE_EFFECTS = 2;
export const ATTRIBUTE_GROWTH_THRESHOLD = 5;

const ATTRIBUTE_IDS = new Set(PLAYER_ATTRIBUTE_DEFINITIONS.map((item) => item.id));

export function createInitialPlayerRuntime() {
  return {
    version: PLAYER_RUNTIME_VERSION,
    attributes: Object.fromEntries(PLAYER_ATTRIBUTE_DEFINITIONS.map((definition) => [
      definition.id,
      {
        base: definition.initial,
        growthCount: 0,
        lastGrowthWeek: null,
      },
    ])),
    activeEffects: [],
  };
}

export function normalizePlayerRuntime(value) {
  const defaults = createInitialPlayerRuntime();
  const source = isObject(value) ? value : {};
  const sourceAttributes = isObject(source.attributes) ? source.attributes : {};

  return {
    version: PLAYER_RUNTIME_VERSION,
    attributes: Object.fromEntries(PLAYER_ATTRIBUTE_DEFINITIONS.map((definition) => {
      const current = isObject(sourceAttributes[definition.id])
        ? sourceAttributes[definition.id]
        : {};

      return [
        definition.id,
        {
          base: clampInteger(current.base, 0, 100, definition.initial),
          growthCount: clampInteger(current.growthCount, 0, 10_000, 0),
          lastGrowthWeek: normalizeOptionalString(current.lastGrowthWeek),
        },
      ];
    })),
    activeEffects: normalizeEffects(source.activeEffects),
  };
}

export function getPlayerRuntimeView(
  value,
  now = new Date().toISOString(),
) {
  const runtime = normalizePlayerRuntime(value);
  const activeEffects = getActiveEffects(runtime.activeEffects, now);
  const values = calculateAttributeValues(runtime.attributes, activeEffects);

  return {
    attributes: PLAYER_ATTRIBUTE_DEFINITIONS.map((definition) => ({
      ...definition,
      base: runtime.attributes[definition.id].base,
      value: values[definition.id],
      affected: activeEffects.some((effect) => (
        Number(effect.changes?.[definition.id] || 0) !== 0
      )),
    })),
    activeEffects: activeEffects.map((effect) => ({
      ...effect,
      remainingMinutes: getRemainingMinutes(effect.expiresAt, now),
    })),
  };
}

export function applyMissionReward(
  value,
  reward,
  {
    now = new Date().toISOString(),
    weekKey = getWeekKey(now),
  } = {},
) {
  const runtime = normalizePlayerRuntime(value);
  const beforeView = getPlayerRuntimeView(runtime, now);
  const normalizedReward = normalizeReward(reward);

  if (!normalizedReward) {
    return {
      runtime: {
        ...runtime,
        activeEffects: getActiveEffects(runtime.activeEffects, now),
      },
      result: {
        attributeChanges: [],
        baseChanges: [],
        effect: null,
      },
    };
  }

  const attributes = cloneAttributes(runtime.attributes);
  const baseChanges = applyGrowth(attributes, normalizedReward.primaryAttribute, weekKey);
  const effect = createEffect(normalizedReward, now);
  const activeEffects = upsertEffect(
    getActiveEffects(runtime.activeEffects, now),
    effect,
  );
  const nextRuntime = {
    ...runtime,
    attributes,
    activeEffects,
  };
  const afterView = getPlayerRuntimeView(nextRuntime, now);

  return {
    runtime: nextRuntime,
    result: {
      attributeChanges: getValueChanges(beforeView.attributes, afterView.attributes),
      baseChanges,
      effect: {
        ...effect,
        remainingMinutes: getRemainingMinutes(effect.expiresAt, now),
      },
    },
  };
}

export function pruneExpiredEffects(value, now = new Date().toISOString()) {
  const runtime = normalizePlayerRuntime(value);
  return {
    ...runtime,
    activeEffects: getActiveEffects(runtime.activeEffects, now),
  };
}

function applyGrowth(attributes, attributeId, weekKey) {
  if (!ATTRIBUTE_IDS.has(attributeId)) return [];

  const current = attributes[attributeId];
  const growthCount = current.growthCount + 1;
  const canGrow = growthCount >= ATTRIBUTE_GROWTH_THRESHOLD
    && current.lastGrowthWeek !== weekKey
    && current.base < 100;

  if (!canGrow) {
    attributes[attributeId] = { ...current, growthCount };
    return [];
  }

  const nextBase = Math.min(100, current.base + 1);
  attributes[attributeId] = {
    ...current,
    base: nextBase,
    growthCount: growthCount - ATTRIBUTE_GROWTH_THRESHOLD,
    lastGrowthWeek: weekKey,
  };

  return [{
    id: attributeId,
    label: getDefinition(attributeId).label,
    before: current.base,
    after: nextBase,
  }];
}

function normalizeReward(value) {
  if (!isObject(value) || !isObject(value.effect)) return null;

  const effectId = normalizeOptionalString(value.effect.id);
  const effectName = normalizeOptionalString(value.effect.name);
  const description = normalizeOptionalString(value.effect.description);
  const changes = normalizeChanges(value.changes);
  const primaryAttribute = ATTRIBUTE_IDS.has(value.primaryAttribute)
    ? value.primaryAttribute
    : Object.keys(changes)[0];

  if (!effectId || !effectName || !description || !primaryAttribute || Object.keys(changes).length === 0) {
    return null;
  }

  return {
    sourceId: normalizeOptionalString(value.sourceId) || effectId,
    primaryAttribute,
    changes,
    effect: {
      id: effectId,
      name: effectName,
      description,
      durationMinutes: clampInteger(
        value.effect.durationMinutes,
        1,
        24 * 60,
        DEFAULT_EFFECT_MINUTES,
      ),
    },
  };
}

function createEffect(reward, now) {
  const startedAtMs = getTimestamp(now);
  const startedAt = new Date(startedAtMs).toISOString();
  const expiresAt = new Date(
    startedAtMs + reward.effect.durationMinutes * 60_000,
  ).toISOString();

  return {
    id: reward.effect.id,
    name: reward.effect.name,
    description: reward.effect.description,
    sourceId: reward.sourceId,
    startedAt,
    expiresAt,
    changes: { ...reward.changes },
  };
}

function upsertEffect(effects, nextEffect) {
  const withoutSame = effects.filter((effect) => effect.id !== nextEffect.id);
  return [...withoutSame, nextEffect]
    .sort((left, right) => Date.parse(left.startedAt) - Date.parse(right.startedAt))
    .slice(-MAX_ACTIVE_EFFECTS);
}

function normalizeEffects(value) {
  if (!Array.isArray(value)) return [];

  return value.flatMap((effect) => {
    if (!isObject(effect)) return [];
    const id = normalizeOptionalString(effect.id);
    const name = normalizeOptionalString(effect.name);
    const description = normalizeOptionalString(effect.description);
    const sourceId = normalizeOptionalString(effect.sourceId);
    const startedAt = normalizeTimestamp(effect.startedAt);
    const expiresAt = normalizeTimestamp(effect.expiresAt);
    const changes = normalizeChanges(effect.changes);

    if (!id || !name || !description || !startedAt || !expiresAt || Object.keys(changes).length === 0) {
      return [];
    }

    return [{
      id,
      name,
      description,
      sourceId: sourceId || id,
      startedAt,
      expiresAt,
      changes,
    }];
  }).slice(-MAX_ACTIVE_EFFECTS);
}

function normalizeChanges(value) {
  if (!isObject(value)) return {};

  return Object.fromEntries(Object.entries(value).flatMap(([id, amount]) => {
    if (!ATTRIBUTE_IDS.has(id)) return [];
    const normalized = clampInteger(amount, -5, 5, 0);
    return normalized === 0 ? [] : [[id, normalized]];
  }));
}

function getActiveEffects(effects, now) {
  const nowMs = getTimestamp(now);
  return normalizeEffects(effects)
    .filter((effect) => Date.parse(effect.expiresAt) > nowMs)
    .slice(-MAX_ACTIVE_EFFECTS);
}

function calculateAttributeValues(attributes, effects) {
  return Object.fromEntries(PLAYER_ATTRIBUTE_DEFINITIONS.map((definition) => {
    const effectValue = effects.reduce(
      (total, effect) => total + Number(effect.changes?.[definition.id] || 0),
      0,
    );
    return [
      definition.id,
      clampInteger(attributes[definition.id].base + effectValue, 0, 100, definition.initial),
    ];
  }));
}

function getValueChanges(before, after) {
  const beforeById = new Map(before.map((item) => [item.id, item]));
  return after.flatMap((item) => {
    const previous = beforeById.get(item.id);
    if (!previous || previous.value === item.value) return [];
    return [{
      id: item.id,
      label: item.label,
      before: previous.value,
      after: item.value,
    }];
  });
}

function getRemainingMinutes(expiresAt, now) {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - getTimestamp(now)) / 60_000));
}

function getWeekKey(now) {
  return getLocalWeekRange(new Date(getTimestamp(now))).key;
}

function getTimestamp(value) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function normalizeTimestamp(value) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) return null;
  return new Date(Date.parse(value)).toISOString();
}

function normalizeOptionalString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cloneAttributes(value) {
  return Object.fromEntries(Object.entries(value).map(([id, current]) => [
    id,
    { ...current },
  ]));
}

function getDefinition(id) {
  return PLAYER_ATTRIBUTE_DEFINITIONS.find((definition) => definition.id === id);
}

function attribute(id, label, english, initial) {
  return Object.freeze({ id, label, english, initial });
}

function clampInteger(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
