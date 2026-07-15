import { appendActivityEvent } from "./activity-log.mjs";
import { normalizeRuntimeStatus } from "./constants.mjs";
import { replaceMaintenance, selectMaintenance } from "./maintenance.mjs";
import { grantDailyExp } from "./progression.mjs";

const DAILY_REWARDS = Object.freeze({
  main: { suffix: "main", exp: 20 },
  maintenance: { suffix: "maintenance", exp: 8 },
  freeRecord: { suffix: "free-record", exp: 8 },
});

export function ensureDailyRun(save, date) {
  const runs = asArray(save?.dailyRuns);

  if (runs.some((run) => run?.date === date)) {
    return save;
  }

  const status = normalizeRuntimeStatus(save?.currentStatus);
  const quest = save?.mainQuest?.status === "active" ? save.mainQuest : null;
  const run = {
    date,
    status,
    mainAction: quest ? {
      questId: quest.id,
      actionId: quest.currentAction?.id || null,
      text: String(quest.currentAction?.text || quest.title).trim(),
      syncedAt: null,
      additionalProgress: [],
    } : null,
    maintenance: selectMaintenance({
      date,
      status,
      recentRuns: runs,
      preferences: save?.maintenancePreferences,
    }),
    freeRecord: null,
  };

  return {
    ...save,
    currentStatus: status,
    dailyRuns: [...runs, run],
  };
}

export function refreshDailyMainAction(save, date) {
  const run = findRun(save, date);

  if (!run || run.mainAction?.syncedAt) {
    return save;
  }

  const quest = save?.mainQuest?.status === "active" ? save.mainQuest : null;

  if (!quest) {
    return run.mainAction === null
      ? save
      : updateRun(save, date, (current) => ({ ...current, mainAction: null }));
  }

  const nextAction = {
    questId: quest.id,
    actionId: quest.currentAction?.id || null,
    text: String(quest.currentAction?.text || quest.title).trim(),
    syncedAt: null,
    additionalProgress: run.mainAction?.questId === quest.id
      ? asArray(run.mainAction?.additionalProgress)
      : [],
  };

  if (
    run.mainAction?.questId === nextAction.questId
    && run.mainAction?.actionId === nextAction.actionId
    && run.mainAction?.text === nextAction.text
  ) {
    return save;
  }

  return updateRun(save, date, (current) => ({ ...current, mainAction: nextAction }));
}

export function syncMainAction(save, date, now = new Date().toISOString()) {
  const run = findRun(save, date);

  if (!run?.mainAction || run.mainAction.syncedAt) {
    return save;
  }

  let next = updateRun(save, date, (current) => ({
    ...current,
    mainAction: { ...current.mainAction, syncedAt: now },
  }));
  next = appendActivityEvent(next, {
    id: `${date}:main`,
    type: "main_action_synced",
    localDate: date,
    at: now,
    questId: run.mainAction.questId,
    payload: { text: run.mainAction.text },
  });

  return grantReward(next, date, "main", now);
}

export function recordAdditionalMainProgress(
  save,
  date,
  text,
  now = new Date().toISOString(),
  { idFactory = createId } = {},
) {
  const run = findRun(save, date);
  const progressText = String(text || "").trim();

  if (!run?.mainAction || !progressText) {
    return save;
  }

  const id = idFactory("progress");
  const progress = { id, text: progressText, at: now };
  let next = updateRun(save, date, (current) => ({
    ...current,
    mainAction: {
      ...current.mainAction,
      additionalProgress: [
        ...asArray(current.mainAction?.additionalProgress),
        progress,
      ],
    },
  }));

  next = appendActivityEvent(next, {
    id: `main-progress:${id}`,
    type: "main_progress_added",
    localDate: date,
    at: now,
    questId: run.mainAction.questId,
    payload: { text: progressText },
  });

  return next;
}

export function syncMaintenance(save, date, now = new Date().toISOString()) {
  const run = findRun(save, date);

  if (!run?.maintenance || run.maintenance.completedAt) {
    return save;
  }

  let next = updateRun(save, date, (current) => ({
    ...current,
    maintenance: { ...current.maintenance, completedAt: now },
  }));
  next = appendActivityEvent(next, {
    id: `${date}:maintenance`,
    type: "maintenance_synced",
    localDate: date,
    at: now,
    questId: null,
    payload: {
      itemId: run.maintenance.itemId,
      title: run.maintenance.title,
    },
  });

  return grantReward(next, date, "maintenance", now);
}

export function saveFreeRecord(save, date, input, now = new Date().toISOString()) {
  const run = findRun(save, date);
  const text = String(input?.text || "").trim();

  if (!run || !text) {
    return save;
  }

  const existing = run.freeRecord;
  const record = {
    text,
    category: String(input?.category || "").trim() || null,
    important: input?.important === true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  let next = updateRun(save, date, (current) => ({ ...current, freeRecord: record }));
  next = appendActivityEvent(next, {
    id: existing ? `free-record-update:${date}:${now}` : `${date}:free-record`,
    type: existing ? "free_record_updated" : "free_record_saved",
    localDate: date,
    at: now,
    questId: null,
    payload: { ...record },
  });

  return grantReward(next, date, "freeRecord", now);
}

export function deleteFreeRecord(save, date, now = new Date().toISOString()) {
  const run = findRun(save, date);

  if (!run?.freeRecord) {
    return save;
  }

  let next = updateRun(save, date, (current) => ({ ...current, freeRecord: null }));
  next = appendActivityEvent(next, {
    id: `free-record-delete:${date}:${now}`,
    type: "free_record_deleted",
    localDate: date,
    at: now,
    questId: null,
    payload: { previousText: run.freeRecord.text },
  });

  return next;
}

export function replaceDailyMaintenance(save, date) {
  const run = findRun(save, date);

  if (!run?.maintenance) {
    return save;
  }

  const nextMaintenance = replaceMaintenance(run.maintenance, {
    date,
    status: run.status,
    recentRuns: asArray(save?.dailyRuns),
    preferences: save?.maintenancePreferences,
  });

  return nextMaintenance === run.maintenance
    ? save
    : updateRun(save, date, (current) => ({ ...current, maintenance: nextMaintenance }));
}

export function setDailyStatus(save, date, status) {
  const run = findRun(save, date);

  if (!run) {
    return save;
  }

  const nextStatus = normalizeRuntimeStatus(status);
  const untouched = !run.maintenance?.completedAt
    && Number(run.maintenance?.replacementCount || 0) === 0;
  const nextMaintenance = untouched ? selectMaintenance({
    date,
    status: nextStatus,
    recentRuns: asArray(save?.dailyRuns),
    preferences: save?.maintenancePreferences,
  }) : run.maintenance;

  return {
    ...updateRun(save, date, (current) => ({
      ...current,
      status: nextStatus,
      maintenance: nextMaintenance,
    })),
    currentStatus: nextStatus,
  };
}

function grantReward(save, date, type, at) {
  const reward = DAILY_REWARDS[type];

  return grantDailyExp(save, {
    key: `${date}:${reward.suffix}`,
    type,
    exp: reward.exp,
    at,
  });
}

function findRun(save, date) {
  return asArray(save?.dailyRuns).find((run) => run?.date === date) || null;
}

function updateRun(save, date, updater) {
  const runs = asArray(save?.dailyRuns);
  const index = runs.findIndex((run) => run?.date === date);

  if (index < 0) {
    return save;
  }

  return {
    ...save,
    dailyRuns: runs.map((run, runIndex) => runIndex === index ? updater(run) : run),
  };
}

function createId(prefix) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
