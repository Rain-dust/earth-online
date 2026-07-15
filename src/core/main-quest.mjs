import { appendActivityEvent } from "./activity-log.mjs";
import { getLocalDateKey } from "./local-date.mjs";

export function createMainQuest(
  save,
  input,
  now = new Date().toISOString(),
  { idFactory = createId } = {},
) {
  const title = String(input?.title || "").trim();
  const text = String(input?.firstAction || "").trim();

  if (!title || !text) {
    throw new Error("主线与第一步不能为空");
  }

  if (save?.mainQuest?.status === "active") {
    throw new Error("已存在活跃主线");
  }

  return {
    ...save,
    mainQuest: {
      id: idFactory("quest"),
      title,
      status: "active",
      startedAt: now,
      currentAction: {
        id: idFactory("action"),
        text,
        createdAt: now,
      },
    },
  };
}

export function setMainQuestAction(
  save,
  text,
  now = new Date().toISOString(),
  { idFactory = createId } = {},
) {
  const actionText = String(text || "").trim();

  if (!actionText) {
    throw new Error("主线行动不能为空");
  }

  if (save?.mainQuest?.status !== "active") {
    throw new Error("当前没有活跃主线");
  }

  return {
    ...save,
    mainQuest: {
      ...save.mainQuest,
      currentAction: {
        id: idFactory("action"),
        text: actionText,
        createdAt: now,
      },
    },
  };
}

export function pauseMainQuest(save, now = new Date().toISOString()) {
  return archiveActiveQuest(save, "paused", now);
}

export function switchMainQuest(
  save,
  input,
  now = new Date().toISOString(),
  options,
) {
  const prepared = save?.mainQuest?.status === "active"
    ? pauseMainQuest(save, now)
    : save;

  return createMainQuest(prepared, input, now, options);
}

export function resumeMainQuest(save, questId, now = new Date().toISOString()) {
  const archive = asArray(save?.mainQuestArchive);
  const target = archive.find((quest) => quest?.id === questId && quest?.status === "paused");

  if (!target) {
    return save;
  }

  const prepared = save?.mainQuest?.status === "active"
    ? pauseMainQuest(save, now)
    : save;
  const preparedArchive = asArray(prepared?.mainQuestArchive);

  return {
    ...prepared,
    mainQuest: {
      ...target,
      status: "active",
      resumedAt: now,
      updatedAt: now,
    },
    mainQuestArchive: preparedArchive.filter((quest) => quest?.id !== questId),
  };
}

export function abandonMainQuest(save, now = new Date().toISOString()) {
  return archiveActiveQuest(save, "abandoned", now);
}

export function completeMainQuest(save, now = new Date().toISOString()) {
  const quest = save?.mainQuest;

  if (quest?.status !== "active") {
    return save;
  }

  const archived = archiveActiveQuest(save, "completed", now);

  return appendActivityEvent(archived, {
    id: `quest-completed:${quest.id}`,
    type: "quest_completed",
    localDate: getLocalDateKey(new Date(now)),
    at: now,
    questId: quest.id,
    payload: { title: quest.title },
  });
}

function archiveActiveQuest(save, status, now) {
  const quest = save?.mainQuest;

  if (quest?.status !== "active") {
    return save;
  }

  const timestampField = {
    paused: "pausedAt",
    abandoned: "abandonedAt",
    completed: "completedAt",
  }[status];
  const archivedQuest = {
    ...quest,
    status,
    updatedAt: now,
    [timestampField]: now,
  };

  return {
    ...save,
    mainQuest: null,
    mainQuestArchive: [...asArray(save?.mainQuestArchive), archivedQuest],
  };
}

function createId(prefix) {
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}
