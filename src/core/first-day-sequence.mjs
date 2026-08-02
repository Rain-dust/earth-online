export const LINK_START_ACHIEVEMENT = Object.freeze({
  id: "link-start",
  title: "LINK START!",
  description: "成功接入地球 Online",
  rarityPercent: 100,
  imageAsset: "./assets/achievements/link-start.png",
});

export function buildFirstDaySequenceView(save = {}, date = "") {
  const run = asArray(save?.dailyRuns).find((item) => item?.date === date) || null;
  const location = save?.profile?.location || null;

  return {
    playerName: String(save?.profile?.nickname || "未命名玩家"),
    location,
    achievement: LINK_START_ACHIEVEMENT,
    task: resolveFirstDayTask(save, run),
  };
}

export function getFirstDaySequenceTimeline(reducedMotion = false) {
  if (reducedMotion) {
    return Object.freeze([
      Object.freeze({ phase: "unlocking", at: 0 }),
      Object.freeze({ phase: "revealed", at: 40 }),
      Object.freeze({ phase: "leaving", at: 1640 }),
      Object.freeze({ phase: "task-ping", at: 1680 }),
      Object.freeze({ phase: "task-live", at: 1740 }),
    ]);
  }

  return Object.freeze([
    Object.freeze({ phase: "unlocking", at: 180 }),
    Object.freeze({ phase: "revealed", at: 720 }),
    Object.freeze({ phase: "leaving", at: 3520 }),
    Object.freeze({ phase: "task-ping", at: 3900 }),
    Object.freeze({ phase: "task-live", at: 4460 }),
  ]);
}

function resolveFirstDayTask(save, run) {
  if (nonempty(run?.maintenance?.title)) {
    return {
      id: run.maintenance.itemId || `${run.date}:maintenance`,
      type: "maintenance",
      title: run.maintenance.title.trim(),
      source: "地球 Online 每日任务",
    };
  }

  return {
    id: `${run?.date || "today"}:fallback`,
    type: "fallback",
    title: "记录今天最值得留下的一件事",
    source: "地球 Online 安全任务",
  };
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function nonempty(value) {
  return typeof value === "string" && value.trim().length > 0;
}
