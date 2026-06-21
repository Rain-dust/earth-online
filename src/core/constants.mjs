export const RUNTIME_STATUSES = Object.freeze({
  STABLE: "stable_operation",
  HIGH_LOAD: "high_load",
  LOW_ENERGY: "low_energy",
  LOST_ROUTE: "lost_route",
  MAINTENANCE: "maintenance_mode",
  MAIN_QUEST_PUSH: "main_quest_push",
});

export const STATUS_LABELS = Object.freeze({
  [RUNTIME_STATUSES.STABLE]: "稳定运行",
  [RUNTIME_STATUSES.HIGH_LOAD]: "高负载",
  [RUNTIME_STATUSES.LOW_ENERGY]: "低能量",
  [RUNTIME_STATUSES.LOST_ROUTE]: "迷航",
  [RUNTIME_STATUSES.MAINTENANCE]: "维护中",
  [RUNTIME_STATUSES.MAIN_QUEST_PUSH]: "主线推进",
});

export const TASK_CATEGORIES = Object.freeze({
  MAIN_QUEST: "main_quest",
  BODY: "body_maintenance",
  INPUT: "cognitive_input",
  OUTPUT: "creative_output",
  ENVIRONMENT: "environment_cleanup",
  NPC: "npc_noise_reduction",
});

export const TASK_CATEGORY_LABELS = Object.freeze({
  [TASK_CATEGORIES.MAIN_QUEST]: "主线维护",
  [TASK_CATEGORIES.BODY]: "身体维护",
  [TASK_CATEGORIES.INPUT]: "认知输入",
  [TASK_CATEGORIES.OUTPUT]: "创作输出",
  [TASK_CATEGORIES.ENVIRONMENT]: "环境整理",
  [TASK_CATEGORIES.NPC]: "NPC 过滤",
});

export const DEFAULT_TAGS = Object.freeze([
  "INTP",
  "INFJ",
  "观察者",
  "夜行型",
  "低耗能",
  "长期主义",
  "创作者",
  "技术流",
  "NPC过滤器",
]);

export const DEFAULT_TASK_POOL = Object.freeze([
  Object.freeze({
    id: "body-low-intensity",
    title: "Execute low-intensity body maintenance",
    category: TASK_CATEGORIES.BODY,
    exp: 12,
    statuses: Object.freeze([
      RUNTIME_STATUSES.HIGH_LOAD,
      RUNTIME_STATUSES.LOW_ENERGY,
      RUNTIME_STATUSES.MAINTENANCE,
    ]),
  }),
  Object.freeze({
    id: "npc-skip-argument",
    title: "Skip one optional NPC argument",
    category: TASK_CATEGORIES.NPC,
    exp: 14,
    statuses: Object.freeze([
      RUNTIME_STATUSES.HIGH_LOAD,
      RUNTIME_STATUSES.LOW_ENERGY,
    ]),
  }),
  Object.freeze({
    id: "environment-clear-one",
    title: "Clear one visible environment item",
    category: TASK_CATEGORIES.ENVIRONMENT,
    exp: 10,
    statuses: Object.freeze([
      RUNTIME_STATUSES.HIGH_LOAD,
      RUNTIME_STATUSES.MAINTENANCE,
    ]),
  }),
  Object.freeze({
    id: "input-reading",
    title: "Read one bounded input source",
    category: TASK_CATEGORIES.INPUT,
    exp: 16,
    statuses: Object.freeze([
      RUNTIME_STATUSES.STABLE,
      RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    ]),
  }),
  Object.freeze({
    id: "output-small-artifact",
    title: "Export one small artifact",
    category: TASK_CATEGORIES.OUTPUT,
    exp: 18,
    statuses: Object.freeze([
      RUNTIME_STATUSES.STABLE,
      RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    ]),
  }),
  Object.freeze({
    id: "route-review",
    title: "Review route and choose next waypoint",
    category: TASK_CATEGORIES.INPUT,
    exp: 15,
    statuses: Object.freeze([
      RUNTIME_STATUSES.LOST_ROUTE,
      RUNTIME_STATUSES.LOW_ENERGY,
      RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    ]),
  }),
]);
