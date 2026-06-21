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
