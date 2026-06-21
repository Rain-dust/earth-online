import {
  DEFAULT_TASK_POOL,
  RUNTIME_STATUSES,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
} from "./constants.mjs";

const TASK_COUNTS_BY_STATUS = Object.freeze({
  [RUNTIME_STATUSES.HIGH_LOAD]: 3,
  [RUNTIME_STATUSES.LOW_ENERGY]: 3,
  [RUNTIME_STATUSES.MAINTENANCE]: 3,
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
  const safeStatus = status || RUNTIME_STATUSES.STABLE;
  const count = TASK_COUNTS_BY_STATUS[safeStatus] || TASK_COUNTS_BY_STATUS[RUNTIME_STATUSES.STABLE];
  const tasks = [];

  if (MAIN_QUEST_STATUSES.has(safeStatus) && mainQuest?.title) {
    tasks.push(createMainQuestTask(mainQuest));
  }

  addTasks(tasks, getStatusWeightedTasks(safeStatus), count, "system");
  addTasks(tasks, customTaskPool, count, "custom");
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

function createMainQuestTask(mainQuest) {
  return {
    id: "main-quest-step",
    title: `Advance main quest: ${mainQuest.title}`,
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

    if (!candidate || hasTask(target, candidate.id)) {
      continue;
    }

    target.push({
      ...candidate,
      source,
    });
  }
}

function normalizeGeneratedTask(task, { date, order, source }) {
  const category = task.category || TASK_CATEGORIES.OUTPUT;

  return {
    id: `${date || "undated"}-${order}-${task.id || slugify(task.title)}`,
    date,
    title: String(task.title || "Execute one bounded system action"),
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

function sanitizeExp(exp) {
  const value = Number(exp);
  return Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0;
}

function slugify(value) {
  return String(value || "task")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "task";
}
