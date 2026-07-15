import {
  DEFAULT_TASK_POOL,
  LEGACY_TASK_TITLE_LABELS,
  normalizeRuntimeStatus,
  RUNTIME_STATUSES,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_TITLE_LABELS,
} from "./constants.mjs";

const TASK_COUNTS_BY_STATUS = Object.freeze({
  [RUNTIME_STATUSES.HIGH_LOAD]: 3,
  [RUNTIME_STATUSES.LOW_ENERGY]: 3,
  [RUNTIME_STATUSES.LOST_ROUTE]: 4,
  [RUNTIME_STATUSES.STABLE]: 5,
  [RUNTIME_STATUSES.MAIN_QUEST_PUSH]: 5,
});

const MAIN_QUEST_STATUSES = new Set([
  RUNTIME_STATUSES.STABLE,
  RUNTIME_STATUSES.MAIN_QUEST_PUSH,
  RUNTIME_STATUSES.LOST_ROUTE,
  RUNTIME_STATUSES.LOW_ENERGY,
]);

export function generateDailyTasks({
  date,
  status,
  mainQuest,
  customTaskPool = [],
} = {}) {
  const safeStatus = normalizeRuntimeStatus(status);
  const count = TASK_COUNTS_BY_STATUS[safeStatus] || TASK_COUNTS_BY_STATUS[RUNTIME_STATUSES.STABLE];
  const safeCustomTaskPool = Array.isArray(customTaskPool) ? customTaskPool : [];
  const tasks = [];

  if (MAIN_QUEST_STATUSES.has(safeStatus) && mainQuest?.title) {
    tasks.push(createMainQuestTask(mainQuest));
  }

  addTasks(tasks, getStatusWeightedTasks(safeStatus), count, "system");
  addTasks(tasks, safeCustomTaskPool, count, "custom");
  addTasks(tasks, DEFAULT_TASK_POOL, count, "fallback");

  return tasks.slice(0, count).map((task, index) => normalizeGeneratedTask(task, {
    date,
    order: index + 1,
    source: task.source,
  }));
}

export function completeTask(task, completedAt = new Date().toISOString()) {
  const nextTask = {
    ...task,
    completed: true,
    completedAt,
  };

  return {
    task: nextTask,
    gainedExp: sanitizeExp(task?.exp),
  };
}

export function expireTask(task, expiredAt = new Date().toISOString()) {
  return {
    ...task,
    expired: true,
    expiredAt,
  };
}

export function localizeTaskCopy(task) {
  if (!task || typeof task !== "object") {
    return task;
  }

  const knownCategory = Object.values(TASK_CATEGORIES).includes(task.category) ? task.category : "";
  const categoryLabel = knownCategory ? TASK_CATEGORY_LABELS[knownCategory] || knownCategory : task.categoryLabel;
  const title = getLocalizedTaskTitle(task);

  if (task.title === title && task.categoryLabel === categoryLabel) {
    return task;
  }

  const nextTask = {
    ...task,
    title,
  };

  if (categoryLabel !== undefined) {
    nextTask.categoryLabel = categoryLabel;
  }

  return nextTask;
}

function createMainQuestTask(mainQuest) {
  return {
    id: "main-quest-step",
    title: `推进主线：${mainQuest.title}`,
    category: TASK_CATEGORIES.MAIN_QUEST,
    exp: 24,
    source: "main_quest",
  };
}

function getStatusWeightedTasks(status) {
  return DEFAULT_TASK_POOL.filter((task) => task.statuses.includes(status));
}

function addTasks(target, candidates, count, source) {
  for (const candidate of candidates) {
    if (target.length >= count) {
      return;
    }

    if (!isValidCandidate(candidate, source) || hasTask(target, candidate.id)) {
      continue;
    }

    target.push({
      ...candidate,
      source,
    });
  }
}

function normalizeGeneratedTask(task, { date, order, source }) {
  const category = getKnownCategory(task.category);

  return {
    id: `${date || "undated"}-${order}-${task.id || slugify(task.title)}`,
    date,
    title: getNormalizedTaskTitle(task, source),
    category,
    categoryLabel: TASK_CATEGORY_LABELS[category] || category,
    exp: sanitizeExp(task.exp),
    order,
    source,
    completed: false,
    expired: false,
  };
}

function hasTask(tasks, id) {
  return id && tasks.some((task) => task.id === id);
}

function isValidCandidate(candidate, source) {
  if (!candidate) {
    return false;
  }

  if (source === "custom") {
    return typeof candidate.title === "string" && candidate.title.trim().length > 0;
  }

  return true;
}

function getKnownCategory(category) {
  return Object.values(TASK_CATEGORIES).includes(category) ? category : TASK_CATEGORIES.OUTPUT;
}

function sanitizeExp(exp) {
  const value = Number(exp);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function getNormalizedTaskTitle(task, source) {
  const title = String(task?.title || "").trim();

  if (source === "custom") {
    return title || "完成一个有边界的系统动作";
  }

  return getLocalizedTaskTitle({ id: task?.id, title });
}

function getLocalizedTaskTitle(task) {
  const title = String(task?.title || "").trim();
  const canonicalId = getCanonicalTaskId(task?.id);

  if (canonicalId && TASK_TITLE_LABELS[canonicalId]) {
    return TASK_TITLE_LABELS[canonicalId];
  }

  if (title.startsWith("Advance main quest: ")) {
    return `推进主线：${title.slice("Advance main quest: ".length)}`;
  }

  return LEGACY_TASK_TITLE_LABELS[title] || title || "完成一个有边界的系统动作";
}

function getCanonicalTaskId(value) {
  const taskId = String(value || "");
  return Object.keys(TASK_TITLE_LABELS).find((id) => taskId === id || taskId.endsWith(`-${id}`));
}

function slugify(value) {
  return String(value || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "task";
}
