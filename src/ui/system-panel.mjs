import { STATUS_LABELS, TASK_CATEGORIES } from "../core/constants.mjs";
import { getAchievementInstanceId, normalizeAchievementArchive } from "../core/achievements.mjs";
import { getAchievementDefinition } from "../core/achievement-catalog.mjs";
import { applyExp, unlockRuntimeAchievements } from "../core/progression.mjs";
import { completeTask, generateDailyTasks, localizeTaskCopy } from "../core/tasks.mjs";
import { openMainQuestDialog } from "./main-quest-dialog.mjs";
import { mountStatusControl } from "./status-control.mjs";

const DEFAULT_NICKNAME = "未命名玩家";
const DEFAULT_TITLE = "地球 Online 观察员";
const PANEL_TAG_LIMIT = 5;
const MAX_DAILY_EXP = 36;

const TASK_COMPLETION_COPY = Object.freeze({
  [TASK_CATEGORIES.INPUT]: "已记录：一次认知维护完成。",
  [TASK_CATEGORIES.OUTPUT]: "已记录：主线推进 +1。",
  [TASK_CATEGORIES.BODY]: "系统确认：角色容器已完成一次维护。",
  [TASK_CATEGORIES.NPC]: "已同步：你成功避开一段无效战斗。",
  [TASK_CATEGORIES.ENVIRONMENT]: "已同步：环境缓存已释放。",
  [TASK_CATEGORIES.MAIN_QUEST]: "已记录：主线推进了一小格。",
});

export function buildMorningView(save, date) {
  const run = asArray(save?.dailyRuns).find((item) => item?.date === date) || null;
  const mainAction = run?.mainAction || null;
  const maintenance = run?.maintenance || null;
  const freeRecord = run?.freeRecord || null;
  const actions = [
    {
      type: "main",
      primary: true,
      empty: !mainAction,
      title: mainAction?.text || "当前没有激活主线",
      context: save?.mainQuest?.title || "MAIN QUEST",
      completed: Boolean(mainAction?.syncedAt),
      actionLabel: !mainAction ? "设定主线" : mainAction.syncedAt ? "已同步" : "同步",
      additionalProgress: asArray(mainAction?.additionalProgress),
    },
    {
      type: "maintenance",
      title: maintenance?.title || "正在生成维护建议",
      completed: Boolean(maintenance?.completedAt),
      actionLabel: maintenance?.completedAt ? "已同步" : "同步",
      canReplace: Boolean(maintenance) && !maintenance.completedAt
        && Number(maintenance.replacementCount || 0) < 1,
    },
    {
      type: "freeRecord",
      title: freeRecord?.text || "留下一条今日记录",
      completed: Boolean(freeRecord),
      important: freeRecord?.important === true,
      actionLabel: freeRecord ? "编辑" : "记录",
      rewardAvailable: !asArray(save?.rewardLedger)
        .some((entry) => entry?.key === `${date}:free-record`),
    },
  ];
  const completed = actions.filter((action) => action.completed).length;

  return {
    date,
    status: run?.status || save?.currentStatus || "stable_operation",
    level: save?.level || { value: 1, exp: 0, nextLevelExp: 16, progress: 0 },
    actions,
    maxDailyExp: MAX_DAILY_EXP,
    sync: {
      completed,
      total: actions.length,
      percent: Math.round((completed / actions.length) * 100),
    },
  };
}

export function getDailyTasksForSave(save, today, { persistGeneratedTasks = true } = {}) {
  const dailyTasks = Array.isArray(save?.dailyTasks) ? save.dailyTasks : [];
  const localizedDailyTasks = dailyTasks.map(localizeTaskCopy);
  const changedExistingTasks = localizedDailyTasks.some((task, index) => task !== dailyTasks[index]);
  const todaysTasks = localizedDailyTasks.filter((task) => task?.date === today);

  if (todaysTasks.length > 0) {
    return {
      save: changedExistingTasks ? { ...save, dailyTasks: localizedDailyTasks } : save,
      tasks: todaysTasks,
      changed: persistGeneratedTasks && changedExistingTasks,
      generated: false,
    };
  }

  const tasks = generateDailyTasks({
    date: today,
    status: save?.currentStatus,
    mainQuest: save?.mainQuest,
    customTaskPool: save?.customTaskPool,
  });
  const nextSave = {
    ...save,
    dailyTasks: [
      ...localizedDailyTasks,
      ...tasks,
    ],
  };

  return {
    save: nextSave,
    tasks,
    changed: persistGeneratedTasks,
    generated: true,
  };
}

export function completePanelTask(save, taskId, completedAt = new Date().toISOString()) {
  const dailyTasks = Array.isArray(save?.dailyTasks) ? save.dailyTasks : [];
  const taskIndex = dailyTasks.findIndex((task) => task?.id === taskId);

  if (taskIndex < 0 || dailyTasks[taskIndex]?.completed) {
    return save;
  }

  const result = completeTask(dailyTasks[taskIndex], completedAt);

  if (!result?.task) {
    return save;
  }

  const taskHistory = Array.isArray(save?.taskHistory) ? save.taskHistory : [];
  const alreadyRecorded = taskHistory.some((task) => task?.id === result.task.id);
  const nextDailyTasks = dailyTasks.map((task, index) => (index === taskIndex ? result.task : task));

  const nextSave = {
    ...save,
    dailyTasks: nextDailyTasks,
    taskHistory: alreadyRecorded ? taskHistory : [...taskHistory, result.task],
    level: alreadyRecorded ? save.level : applyExp(save?.level, result.gainedExp),
  };

  return unlockRuntimeAchievements(nextSave, completedAt);
}

export function getVisibleTags(save) {
  const hiddenTags = new Set(asArray(save?.settings?.hiddenTags).map(String));
  const fixedTags = asArray(save?.settings?.fixedTags);
  const recommendedTags = [
    ...asArray(save?.profile?.selectedTags),
    ...asArray(save?.profile?.customTags),
    ...asArray(save?.tags),
  ];
  const tags = [];

  for (const tag of [...fixedTags, ...recommendedTags]) {
    const label = String(tag || "").trim();

    if (!label || hiddenTags.has(label) || tags.includes(label)) {
      continue;
    }

    tags.push(label);
  }

  return tags.slice(0, PANEL_TAG_LIMIT);
}

export function getDailySyncStats(tasks) {
  const taskList = asArray(tasks);
  const total = taskList.length;
  const completed = taskList.filter((task) => task?.completed).length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    total,
    percent,
    label: `${completed} / ${total}`,
  };
}

export function getOnlineStreakDays(save, today) {
  const dates = new Set(asArray(save?.dailyTasks)
    .map((task) => task?.date)
    .filter((date) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)));
  let cursor = parseDateKey(today);
  let streak = 0;

  if (!cursor) {
    return 0;
  }

  while (dates.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export function getTaskCompletionMessage(task) {
  return TASK_COMPLETION_COPY[task?.category] || "已同步：你没有白过这一小段时间。";
}

export function getTaskActionState(task, { allowCompletion = true } = {}) {
  if (task?.completed) {
    return { disabled: true, label: "已同步" };
  }

  if (!allowCompletion) {
    return { disabled: true, label: "预览" };
  }

  return { disabled: false, label: "同步" };
}

export function getArchiveEntryState(save) {
  const archive = normalizeAchievementArchive(save?.achievementArchive);
  const confirmedIds = new Set(asArray(save?.achievements)
    .map(getAchievementInstanceId)
    .filter((id) => getAchievementDefinition(id)));

  if (archive.scanStatus !== "complete") {
    const pendingCount = archive.candidateIds.filter((id) => !confirmedIds.has(id)).length;
    return {
      label: "进入夜间档案馆",
      badge: pendingCount > 0 ? `${pendingCount} 条待确认` : "旧存档待扫描",
    };
  }

  return {
    label: "进入夜间档案馆",
    badge: `${confirmedIds.size} 项记录`,
  };
}

export function getMorningPanelMarkup(view, {
  nickname = DEFAULT_NICKNAME,
  selectedTitle = DEFAULT_TITLE,
  tags = [],
  archiveEntry = { label: "进入夜间档案馆", badge: "旧存档待扫描" },
  systemMessage = "",
  expFlash = null,
} = {}) {
  const [main, maintenance, freeRecord] = view.actions;
  const progress = getProgressPercent(view.level);

  return `
    <header class="panel-topbar">
      <div class="panel-brand" aria-label="地球 Online">
        <span class="brand-mark" aria-hidden="true"></span>
        <strong>地球 Online</strong>
      </div>
      <div class="panel-meta">
        <span>${escapeHtml(getMorningTimeLabel())}</span>
        <div data-status-host></div>
      </div>
      <div class="panel-controls">
        <button class="archive-entry" type="button" aria-label="${escapeHtml(archiveEntry.label)}" title="夜间档案馆">
          <i data-lucide="moon-star" aria-hidden="true"></i>
          <small>${escapeHtml(archiveEntry.badge)}</small>
        </button>
        <button class="panel-exit icon-button" type="button" aria-label="退出系统面板" title="退出">
          <i data-lucide="x" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <section class="morning-identity" aria-label="玩家状态">
      <div class="morning-greeting">
        <span class="section-kicker">TODAY / ${escapeHtml(view.date)}</span>
        <h2>早安，${escapeHtml(nickname)}</h2>
        <div class="identity-strip">
          <strong>${escapeHtml(selectedTitle)}</strong>
          <div class="tag-strip">${renderTags(tags)}</div>
        </div>
      </div>
      <div class="compact-vitals" aria-label="等级与经验">
        <div>
          <span>等级</span>
          <strong>Lv.${escapeHtml(view.level.value || 1)}</strong>
        </div>
        <div class="compact-exp">
          <span>经验</span>
          <strong>${escapeHtml(view.level.exp || 0)} / ${escapeHtml(view.level.nextLevelExp || 16)}</strong>
          <meter min="0" max="100" value="${progress}"></meter>
        </div>
        <div>
          <span>今日同步</span>
          <strong>${escapeHtml(view.sync.completed)} / ${escapeHtml(view.sync.total)}</strong>
        </div>
      </div>
    </section>

    ${systemMessage ? `<p class="system-feedback" role="status">${escapeHtml(systemMessage)}</p>` : ""}

    <section class="daily-runtime" aria-label="今日运行">
      <article class="main-action ${main.completed ? "is-complete" : ""}" ${flashAttribute(expFlash, "main")}>
        <div class="runtime-icon main-runtime-icon"><i data-lucide="route" aria-hidden="true"></i></div>
        <div class="runtime-copy">
          <span>${escapeHtml(main.context)}</span>
          <h3>${escapeHtml(main.title)}</h3>
        </div>
        <div class="runtime-actions">
          ${main.empty ? `
            <button class="primary-runtime-button" type="button" data-action="open-main-quest">${escapeHtml(main.actionLabel)}</button>
          ` : `
            <button class="icon-button" type="button" data-action="open-main-quest" aria-label="管理主线" title="管理主线">
              <i data-lucide="settings-2" aria-hidden="true"></i>
            </button>
            <button class="icon-button" type="button" data-action="add-main-progress" aria-label="追加进展" title="追加进展">
              <i data-lucide="plus" aria-hidden="true"></i>
            </button>
            <button class="primary-runtime-button" type="button" data-action="sync-main" ${main.completed ? "disabled" : ""}>${escapeHtml(main.actionLabel)}</button>
          `}
        </div>
        <form class="inline-runtime-form main-progress-form" hidden>
          <label class="sr-only" for="main-progress-input">追加主线进展</label>
          <input id="main-progress-input" name="text" maxlength="100" placeholder="记录一段额外推进" required />
          <button type="submit">记录</button>
        </form>
      </article>

      <article class="maintenance-action ${maintenance.completed ? "is-complete" : ""}" ${flashAttribute(expFlash, "maintenance")}>
        <div class="runtime-icon"><i data-lucide="heart-pulse" aria-hidden="true"></i></div>
        <div class="runtime-copy">
          <span>今日维护</span>
          <h3>${escapeHtml(maintenance.title)}</h3>
        </div>
        <div class="runtime-actions">
          ${maintenance.canReplace ? `
            <button class="icon-button" type="button" data-action="replace-maintenance" aria-label="换一个维护建议" title="换一个">
              <i data-lucide="refresh-cw" aria-hidden="true"></i>
            </button>
          ` : ""}
          <button class="secondary-runtime-button" type="button" data-action="sync-maintenance" ${maintenance.completed ? "disabled" : ""}>${escapeHtml(maintenance.actionLabel)}</button>
        </div>
      </article>

      <div class="free-record-slot ${freeRecord.completed ? "has-record" : ""}" ${flashAttribute(expFlash, "freeRecord")}>
        <button class="free-record-trigger" type="button" data-action="toggle-free-record" aria-expanded="false">
          <span class="runtime-icon"><i data-lucide="${freeRecord.important ? "star" : "plus"}" aria-hidden="true"></i></span>
          <span class="runtime-copy">
            <span>自由记录</span>
            <strong>${escapeHtml(freeRecord.title)}</strong>
          </span>
          <span>${escapeHtml(freeRecord.actionLabel)}</span>
        </button>
        <form class="inline-runtime-form free-record-form" hidden>
          <label class="sr-only" for="free-record-input">自由记录</label>
          <input id="free-record-input" name="text" maxlength="120" value="${escapeHtml(freeRecord.completed ? freeRecord.title : "")}" placeholder="今天有什么值得留下？" required />
          <label class="important-toggle"><input type="checkbox" name="important" ${freeRecord.important ? "checked" : ""} /> 重要</label>
          ${freeRecord.completed ? `<button type="button" data-action="delete-free-record">删除</button>` : ""}
          <button type="submit">保存</button>
        </form>
      </div>
    </section>

    <footer class="panel-actions">
      <span class="panel-footer-mark">LOCAL SAVE / EARTH-01</span>
      <button class="icon-button" type="button" data-action="export" aria-label="导出存档" title="导出存档">
        <i data-lucide="download" aria-hidden="true"></i>
      </button>
      <label class="import-button icon-button" title="导入存档">
        <span class="sr-only">导入存档</span>
        <i data-lucide="upload" aria-hidden="true"></i>
        <input type="file" accept="application/json,.json" />
      </label>
    </footer>
  `;
}

export function renderSystemPanel(root, {
  save,
  today = new Date().toLocaleDateString("en-CA"),
  onStatusChange,
  onMainSync,
  onMainProgress,
  onMaintenanceSync,
  onMaintenanceReplace,
  onFreeRecordSave,
  onFreeRecordDelete,
  onMainQuestCreate,
  onMainQuestActionChange,
  onMainQuestPause,
  onMainQuestComplete,
  onMainQuestSwitch,
  onMainQuestAbandon,
  onOpenArchive,
  onExit,
}) {
  const view = buildMorningView(save, today);
  const expFlash = root.dataset.expFlashType ? {
    type: root.dataset.expFlashType,
    value: root.dataset.expFlashValue,
  } : null;
  const panel = document.createElement("section");
  panel.className = "system-panel morning-brief";
  panel.setAttribute("aria-label", "地球 Online 清晨系统面板");
  panel.innerHTML = getMorningPanelMarkup(view, {
    nickname: save?.profile?.nickname || DEFAULT_NICKNAME,
    selectedTitle: getSelectedTitle(save),
    tags: getVisibleTags(save),
    archiveEntry: getArchiveEntryState(save),
    systemMessage: root.dataset.systemMessage || "",
    expFlash,
  });

  root.replaceChildren(panel);
  mountStatusControl(panel.querySelector("[data-status-host]"), {
    currentStatus: view.status,
    onStatusChange,
  });

  panel.querySelector(".panel-exit").addEventListener("click", () => onExit?.());
  panel.querySelector(".archive-entry").addEventListener("click", () => onOpenArchive?.());
  panel.querySelector("[data-action='export']").addEventListener("click", () => {
    panel.dispatchEvent(new CustomEvent("earth-online-export", { bubbles: true }));
  });
  panel.querySelector(".import-button input").addEventListener("change", (event) => {
    const [file] = event.currentTarget.files || [];
    if (file) {
      panel.dispatchEvent(new CustomEvent("earth-online-import", { bubbles: true, detail: file }));
    }
  });

  panel.querySelector("[data-action='open-main-quest']").addEventListener("click", () => {
    openMainQuestDialog(root, {
      save,
      onCreate: onMainQuestCreate,
      onSaveAction: onMainQuestActionChange,
      onPause: onMainQuestPause,
      onComplete: onMainQuestComplete,
      onSwitch: onMainQuestSwitch,
      onAbandon: onMainQuestAbandon,
    });
  });

  panel.querySelector("[data-action='sync-main']")?.addEventListener("click", () => {
    setExpFlash(root, "main", "+20");
    onMainSync?.();
  });
  panel.querySelector("[data-action='add-main-progress']")?.addEventListener("click", () => {
    toggleInlineForm(panel, ".main-progress-form", "[data-action='add-main-progress']");
  });
  panel.querySelector(".main-progress-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = new FormData(event.currentTarget).get("text");
    onMainProgress?.(text);
  });
  panel.querySelector("[data-action='sync-maintenance']").addEventListener("click", () => {
    setExpFlash(root, "maintenance", "+8");
    onMaintenanceSync?.();
  });
  panel.querySelector("[data-action='replace-maintenance']")?.addEventListener("click", () => {
    onMaintenanceReplace?.();
  });
  panel.querySelector("[data-action='toggle-free-record']").addEventListener("click", () => {
    toggleInlineForm(panel, ".free-record-form", "[data-action='toggle-free-record']");
  });
  panel.querySelector(".free-record-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (view.actions[2].rewardAvailable) {
      setExpFlash(root, "freeRecord", "+8");
    }
    onFreeRecordSave?.({
      text: data.get("text"),
      important: data.get("important") === "on",
    });
  });
  panel.querySelector("[data-action='delete-free-record']")?.addEventListener("click", () => {
    onFreeRecordDelete?.();
  });

  globalThis.lucide?.createIcons({ root: panel });
  clearExpFlashAfterDelay(root, panel, expFlash);
}

function flashAttribute(expFlash, type) {
  return expFlash?.type === type
    ? `data-exp-flash="${escapeHtml(expFlash.value || "")}"`
    : "";
}

function setExpFlash(root, type, value) {
  root.dataset.expFlashType = type;
  root.dataset.expFlashValue = value;
}

function clearExpFlashAfterDelay(root, panel, expFlash) {
  if (!expFlash) return;

  globalThis.setTimeout?.(() => {
    panel.querySelector("[data-exp-flash]")?.removeAttribute("data-exp-flash");
    if (root.dataset.expFlashType === expFlash.type) {
      delete root.dataset.expFlashType;
      delete root.dataset.expFlashValue;
    }
  }, 1200);
}

function toggleInlineForm(panel, formSelector, triggerSelector) {
  const form = panel.querySelector(formSelector);
  const trigger = panel.querySelector(triggerSelector);
  const opening = form.hidden;

  form.hidden = !opening;
  form.closest(".free-record-slot")?.classList.toggle("is-editing", opening);
  trigger?.setAttribute("aria-expanded", String(opening));
  if (opening) form.querySelector("input")?.focus();
}

function renderTaskRow(task, { allowTaskCompletion = true, isLastSynced = false } = {}) {
  const action = getTaskActionState(task, { allowCompletion: allowTaskCompletion });

  return `
    <article class="task-row ${action.disabled ? "is-complete" : ""} ${isLastSynced ? "is-syncing" : ""}">
      <span class="task-icon">${escapeHtml(getTaskIconLabel(task))}</span>
      <div class="task-copy">
        <span>${escapeHtml(task?.categoryLabel || task?.category || "任务")}</span>
        <strong>${escapeHtml(task?.title || "完成一个有边界的系统动作")}</strong>
      </div>
      <span class="task-exp">+${escapeHtml(task?.exp || 0)} 经验</span>
      <button class="sync-button" type="button" data-task-id="${escapeHtml(task?.id || "")}" ${action.disabled ? "disabled" : ""}>
        ${escapeHtml(action.label)}
      </button>
    </article>
  `;
}

function renderVital(label, value, suffix) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${suffix ? `<small>${escapeHtml(suffix)}</small>` : ""}
    </div>
  `;
}

function renderTags(tags) {
  if (tags.length === 0) {
    return "<span>未配置标签</span>";
  }

  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
}

function getTaskIconLabel(task) {
  switch (task?.category) {
    case TASK_CATEGORIES.INPUT:
      return "认";
    case TASK_CATEGORIES.OUTPUT:
      return "创";
    case TASK_CATEGORIES.BODY:
      return "身";
    case TASK_CATEGORIES.NPC:
      return "NPC";
    case TASK_CATEGORIES.ENVIRONMENT:
      return "境";
    case TASK_CATEGORIES.MAIN_QUEST:
      return "主";
    default:
      return "行";
  }
}

function getMorningTimeLabel(date = new Date()) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `晨光 ${hours}:${minutes}`;
}

function getSelectedTitle(save) {
  const selectedTitle = save?.settings?.selectedTitle;
  const ownedTitles = asArray(save?.titles);

  if (selectedTitle && (ownedTitles.length === 0 || ownedTitles.includes(selectedTitle))) {
    return selectedTitle;
  }

  return ownedTitles[0] || DEFAULT_TITLE;
}

function getStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.stable_operation || "稳定运行";
}

function getProgressPercent(level) {
  if (Number.isFinite(Number(level?.progress))) {
    return Math.round(Math.min(1, Math.max(0, Number(level.progress))) * 100);
  }

  const exp = Number(level?.exp);
  const next = Number(level?.nextLevelExp);

  if (!Number.isFinite(exp) || !Number.isFinite(next) || next <= 0) {
    return 0;
  }

  return Math.round(Math.min(1, Math.max(0, exp / next)) * 100);
}

function parseDateKey(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
