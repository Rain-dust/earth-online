export const RUNTIME_STATUSES = Object.freeze({
  STABLE: "stable_operation",
  HIGH_LOAD: "high_load",
  LOW_ENERGY: "low_energy",
  LOST_ROUTE: "lost_route",
  MAIN_QUEST_PUSH: "main_quest_push",
});

export const STATUS_LABELS = Object.freeze({
  [RUNTIME_STATUSES.STABLE]: "稳定运行",
  [RUNTIME_STATUSES.HIGH_LOAD]: "高负载",
  [RUNTIME_STATUSES.LOW_ENERGY]: "低能量",
  [RUNTIME_STATUSES.LOST_ROUTE]: "迷航",
  [RUNTIME_STATUSES.MAIN_QUEST_PUSH]: "主线推进",
});

export function normalizeRuntimeStatus(value) {
  if (value === "maintenance_mode") {
    return RUNTIME_STATUSES.LOW_ENERGY;
  }

  return Object.values(RUNTIME_STATUSES).includes(value)
    ? value
    : RUNTIME_STATUSES.STABLE;
}

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

export const TASK_TITLE_LABELS = Object.freeze({
  "body-low-intensity": "进行一次低强度身体维护",
  "npc-skip-argument": "跳过一次可有可无的 NPC 争论",
  "environment-clear-one": "清理一个可见环境项",
  "input-reading": "阅读一份有边界的信息源",
  "output-small-artifact": "产出一个小型作品",
  "route-review": "复盘路线并选择下一个坐标",
});

export const LEGACY_TASK_TITLE_LABELS = Object.freeze({
  "Execute low-intensity body maintenance": TASK_TITLE_LABELS["body-low-intensity"],
  "Skip one optional NPC argument": TASK_TITLE_LABELS["npc-skip-argument"],
  "Clear one visible environment item": TASK_TITLE_LABELS["environment-clear-one"],
  "Read one bounded input source": TASK_TITLE_LABELS["input-reading"],
  "Export one small artifact": TASK_TITLE_LABELS["output-small-artifact"],
  "Review route and choose next waypoint": TASK_TITLE_LABELS["route-review"],
  "Execute one bounded system action": "完成一个有边界的系统动作",
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

export const MAINTENANCE_CATALOG = Object.freeze([
  maintenance("stretch-five", "伸展 5 分钟", 5, RUNTIME_STATUSES.STABLE),
  maintenance("clear-visible-item", "清理一个可见杂物", 8, RUNTIME_STATUSES.STABLE),
  maintenance("drink-water", "喝一杯水", 3, RUNTIME_STATUSES.STABLE),
  maintenance("reply-important-message", "回复一条重要消息", 10, RUNTIME_STATUSES.STABLE),
  maintenance("leave-screen-ten", "离开屏幕 10 分钟", 10, RUNTIME_STATUSES.HIGH_LOAD),
  maintenance("close-noise-source", "关闭一个不必要的信息源", 5, RUNTIME_STATUSES.HIGH_LOAD),
  maintenance("postpone-nonessential", "推迟一项非必要任务", 5, RUNTIME_STATUSES.HIGH_LOAD),
  maintenance("tidy-work-area", "整理当前工作区域", 10, RUNTIME_STATUSES.HIGH_LOAD),
  maintenance("drink-and-wash", "喝水并简单洗漱", 8, RUNTIME_STATUSES.LOW_ENERGY),
  maintenance("outside-five", "到窗边或户外待 5 分钟", 5, RUNTIME_STATUSES.LOW_ENERGY),
  maintenance("gentle-stretch", "进行一次低强度伸展", 8, RUNTIME_STATUSES.LOW_ENERGY),
  maintenance("prepare-basic-food", "准备一份基础食物", 20, RUNTIME_STATUSES.LOW_ENERGY),
  maintenance("write-smallest-step", "写下当前最小的下一步", 5, RUNTIME_STATUSES.LOST_ROUTE),
  maintenance("delete-stale-todo", "删除一条过期待办", 5, RUNTIME_STATUSES.LOST_ROUTE),
  maintenance("improve-environment", "改善一个可见环境项", 10, RUNTIME_STATUSES.LOST_ROUTE),
  maintenance("pause-unimportant-goal", "暂停一个不重要的目标", 8, RUNTIME_STATUSES.LOST_ROUTE),
  maintenance("remove-one-distraction", "移除一个主线干扰项", 5, RUNTIME_STATUSES.MAIN_QUEST_PUSH),
  maintenance("prepare-main-materials", "准备下一步需要的材料", 15, RUNTIME_STATUSES.MAIN_QUEST_PUSH),
  maintenance("reserve-focus-ten", "预留 10 分钟不受打扰的时间", 10, RUNTIME_STATUSES.MAIN_QUEST_PUSH),
  maintenance("log-main-blocker", "记录一个主线阻塞点", 8, RUNTIME_STATUSES.MAIN_QUEST_PUSH),
]);

export const DEFAULT_TASK_POOL = Object.freeze([
  Object.freeze({
    id: "body-low-intensity",
    title: TASK_TITLE_LABELS["body-low-intensity"],
    category: TASK_CATEGORIES.BODY,
    exp: 12,
    statuses: Object.freeze([
      RUNTIME_STATUSES.HIGH_LOAD,
      RUNTIME_STATUSES.LOW_ENERGY,
    ]),
  }),
  Object.freeze({
    id: "npc-skip-argument",
    title: TASK_TITLE_LABELS["npc-skip-argument"],
    category: TASK_CATEGORIES.NPC,
    exp: 14,
    statuses: Object.freeze([
      RUNTIME_STATUSES.HIGH_LOAD,
      RUNTIME_STATUSES.LOW_ENERGY,
    ]),
  }),
  Object.freeze({
    id: "environment-clear-one",
    title: TASK_TITLE_LABELS["environment-clear-one"],
    category: TASK_CATEGORIES.ENVIRONMENT,
    exp: 10,
    statuses: Object.freeze([
      RUNTIME_STATUSES.HIGH_LOAD,
    ]),
  }),
  Object.freeze({
    id: "input-reading",
    title: TASK_TITLE_LABELS["input-reading"],
    category: TASK_CATEGORIES.INPUT,
    exp: 16,
    statuses: Object.freeze([
      RUNTIME_STATUSES.STABLE,
      RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    ]),
  }),
  Object.freeze({
    id: "output-small-artifact",
    title: TASK_TITLE_LABELS["output-small-artifact"],
    category: TASK_CATEGORIES.OUTPUT,
    exp: 18,
    statuses: Object.freeze([
      RUNTIME_STATUSES.STABLE,
      RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    ]),
  }),
  Object.freeze({
    id: "route-review",
    title: TASK_TITLE_LABELS["route-review"],
    category: TASK_CATEGORIES.INPUT,
    exp: 15,
    statuses: Object.freeze([
      RUNTIME_STATUSES.LOST_ROUTE,
      RUNTIME_STATUSES.LOW_ENERGY,
      RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    ]),
  }),
]);

function maintenance(id, title, maxMinutes, ...statuses) {
  return Object.freeze({
    id,
    title,
    maxMinutes,
    statuses: Object.freeze(statuses),
  });
}
