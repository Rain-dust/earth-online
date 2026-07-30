import { formatPlayerLocation } from "./player-location.mjs";

const QUEST_ACTIVITY_EVENT_TYPES = new Set([
  "main_action_synced",
  "main_progress_added",
]);

const ACTIONS = Object.freeze({
  firstConnection: Object.freeze([
    Object.freeze({ id: "continue", label: "进入地球" }),
  ]),
  activeMainQuest: Object.freeze([
    Object.freeze({ id: "record_progress", label: "记录进度" }),
    Object.freeze({ id: "view_main_quest", label: "查看主线" }),
    Object.freeze({ id: "dismiss", label: "暂不处理" }),
  ]),
  normalReturn: Object.freeze([
    Object.freeze({ id: "continue", label: "继续运行" }),
  ]),
});

export function resolveCurrentMainQuestLastActivityAt(save = {}) {
  const quest = save?.mainQuest?.status === "active" ? save.mainQuest : null;

  if (!quest?.id) {
    return null;
  }

  const candidates = [
    quest.startedAt,
    quest.updatedAt,
    quest.currentAction?.createdAt,
    ...asArray(save?.activityEvents)
      .filter((event) => event?.questId === quest.id
        && QUEST_ACTIVITY_EVENT_TYPES.has(event?.type))
      .map((event) => event.at),
  ].filter(isValidTimestamp);

  if (candidates.length === 0) {
    return null;
  }

  return candidates.reduce((latest, candidate) => (
    Date.parse(candidate) > Date.parse(latest) ? candidate : latest
  ));
}

export function formatTimeDistance(timestamp, now = new Date().toISOString()) {
  if (!isValidTimestamp(timestamp) || !isValidTimestamp(now)) {
    return { status: "unknown", text: "时间未知" };
  }

  const distanceMs = Date.parse(now) - Date.parse(timestamp);

  if (!Number.isFinite(distanceMs) || distanceMs < 0) {
    return { status: "unknown", text: "时间未知" };
  }

  const totalMinutes = Math.floor(distanceMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return {
      status: "known",
      text: `${days} 天${hours > 0 ? ` ${hours} 小时` : ""}`,
    };
  }

  if (hours > 0) {
    return {
      status: "known",
      text: `${hours} 小时${minutes > 0 ? ` ${minutes} 分钟` : ""}`,
    };
  }

  return {
    status: "known",
    text: minutes > 0 ? `${minutes} 分钟` : "不到 1 分钟",
  };
}

export function resolveSystemBroadcast(save = {}, {
  now = new Date().toISOString(),
  previousLastActiveAt = null,
} = {}) {
  const quest = save?.mainQuest?.status === "active" ? save.mainQuest : null;

  if (!save?.connection?.firstConnectedAt) {
    return {
      type: "first_connection",
      priority: 200,
      source: "connection",
      content: {
        playerName: String(save?.profile?.nickname || "未命名玩家").trim() || "未命名玩家",
        location: formatPlayerLocation(save?.profile?.location),
        questName: quest ? String(quest.title || "").trim() : "",
      },
      actions: ACTIONS.firstConnection.map((action) => ({ ...action })),
    };
  }

  if (quest) {
    const lastProgressAt = resolveCurrentMainQuestLastActivityAt(save);

    return {
      type: "active_main_quest",
      priority: 100,
      source: "main_quest",
      content: {
        questName: String(quest.title || "未命名主线").trim() || "未命名主线",
        lastProgressAt,
        lastProgressDistance: formatTimeDistance(lastProgressAt, now),
      },
      actions: ACTIONS.activeMainQuest.map((action) => ({ ...action })),
    };
  }

  return {
    type: "normal_return",
    priority: 10,
    source: "connection",
    content: {
      playerName: String(save?.profile?.nickname || "未命名玩家").trim() || "未命名玩家",
      connectionDistance: previousLastActiveAt
        ? formatTimeDistance(previousLastActiveAt, now)
        : { status: "first_connection", text: "首次连接" },
    },
    actions: ACTIONS.normalReturn.map((action) => ({ ...action })),
  };
}

function isValidTimestamp(value) {
  return typeof value === "string"
    && value.trim() !== ""
    && Number.isFinite(Date.parse(value));
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
