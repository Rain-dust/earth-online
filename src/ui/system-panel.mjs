import { STATUS_LABELS, TASK_CATEGORIES } from "../core/constants.mjs";
import { getAchievementInstanceId, normalizeAchievementArchive } from "../core/achievements.mjs";
import { applyExp, unlockRuntimeAchievements } from "../core/progression.mjs";
import { completeTask, generateDailyTasks, localizeTaskCopy } from "../core/tasks.mjs";

const DEFAULT_NICKNAME = "未命名玩家";
const DEFAULT_TITLE = "地球 Online 观察员";
const PANEL_TAG_LIMIT = 5;

const TASK_COMPLETION_COPY = Object.freeze({
  [TASK_CATEGORIES.INPUT]: "已记录：一次认知维护完成。",
  [TASK_CATEGORIES.OUTPUT]: "已记录：主线推进 +1。",
  [TASK_CATEGORIES.BODY]: "系统确认：角色容器已完成一次维护。",
  [TASK_CATEGORIES.NPC]: "已同步：你成功避开一段无效战斗。",
  [TASK_CATEGORIES.ENVIRONMENT]: "已同步：环境缓存已释放。",
  [TASK_CATEGORIES.MAIN_QUEST]: "已记录：主线推进了一小格。",
});

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
    .filter(Boolean));

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

export function renderSystemPanel(root, {
  save,
  onChange,
  onOpenArchive,
  onExit,
  persistGeneratedTasks = true,
}) {
  const systemMessage = root.dataset.systemMessage || "";
  const today = new Date().toISOString().slice(0, 10);
  const daily = getDailyTasksForSave(save, today, { persistGeneratedTasks });
  const activeSave = daily.save;
  const tags = getVisibleTags(activeSave);
  const level = activeSave?.level || {};
  const progress = getProgressPercent(level);
  const syncStats = getDailySyncStats(daily.tasks);
  const streakDays = getOnlineStreakDays(activeSave, today);
  const allowTaskCompletion = persistGeneratedTasks || !daily.generated;
  const nickname = activeSave?.profile?.nickname || DEFAULT_NICKNAME;
  const selectedTitle = getSelectedTitle(activeSave);
  const statusLabel = getStatusLabel(activeSave?.currentStatus);
  const scanMessage = systemMessage || "少跟 NPC 纠缠，多推进主线。";
  const lastSyncedTaskId = root.dataset.lastSyncedTaskId || "";
  const archiveEntry = getArchiveEntryState(activeSave);

  root.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "system-panel morning-brief";
  panel.style.setProperty("--sync-percent", `${syncStats.percent}%`);
  panel.setAttribute("aria-label", "地球 Online 清晨系统简报");
  panel.innerHTML = `
    <header class="panel-topbar">
      <div class="panel-brand" aria-label="地球 Online">
        <span class="brand-mark" aria-hidden="true"></span>
        <strong>地球 Online</strong>
      </div>
      <div class="panel-meta" aria-label="系统状态">
        <span>${escapeHtml(getMorningTimeLabel())}</span>
        <span>${escapeHtml(statusLabel)}</span>
      </div>
      <div class="panel-controls">
        <button class="archive-entry" type="button" aria-label="${escapeHtml(archiveEntry.label)}" title="夜间档案馆">
          <span aria-hidden="true">◐</span>
          <small>${escapeHtml(archiveEntry.badge)}</small>
        </button>
        <button class="panel-exit" type="button" aria-label="退出系统面板">×</button>
      </div>
    </header>

    <div class="panel-workspace">
      <section class="scan-brief" aria-label="今日状态扫描">
        <span class="section-kicker">今日状态扫描</span>
        <h2>早安，${escapeHtml(nickname)}</h2>
        <p>${escapeHtml(scanMessage)}</p>
      </section>

      <section class="vitals-panel" aria-label="玩家人生体征">
        <div class="sync-orb" aria-label="今日同步率 ${syncStats.percent}%">
          <span>今日同步率</span>
          <strong>${escapeHtml(syncStats.percent)}%</strong>
          <small>${escapeHtml(syncStats.label)}</small>
        </div>

        <div class="vital-grid">
          ${renderVital("连续上线", `${streakDays || 1}`, "天")}
          ${renderVital("等级", `Lv.${level.value || 1}`, "")}
          <div class="exp-vital">
            <span>经验进度</span>
            <strong>${escapeHtml(progress)}%</strong>
            <meter min="0" max="100" value="${progress}"></meter>
            <small>${escapeHtml(level.exp || 0)} / ${escapeHtml(level.nextLevelExp || 100)} 经验</small>
          </div>
        </div>

        <div class="identity-strip" aria-label="称号与标签">
          <strong>${escapeHtml(selectedTitle)}</strong>
          <div class="tag-strip">
            ${renderTags(tags)}
          </div>
        </div>
      </section>

      <section class="daily-tasks" aria-label="今日维护队列">
        <header>
          <div>
            <span class="section-kicker">今日维护队列</span>
            <strong>${escapeHtml(daily.tasks.length)} 项待同步</strong>
          </div>
          <time datetime="${escapeHtml(today)}">${escapeHtml(today)}</time>
        </header>
        <div class="task-list">
          ${daily.tasks.map((task) => renderTaskRow(task, {
            allowTaskCompletion,
            isLastSynced: task?.id === lastSyncedTaskId,
          })).join("")}
        </div>
      </section>
    </div>

    <footer class="panel-actions">
      <span class="panel-footer-mark">LOCAL SAVE / EARTH-01</span>
      <button type="button" data-action="export">导出存档</button>
      <label class="import-button">
        <span>导入存档</span>
        <input type="file" accept="application/json,.json" />
      </label>
    </footer>
  `;

  panel.querySelector(".panel-exit").addEventListener("click", () => {
    onExit?.();
  });
  panel.querySelector(".archive-entry").addEventListener("click", () => {
    onOpenArchive?.();
  });
  panel.querySelector("[data-action='export']").addEventListener("click", () => {
    panel.dispatchEvent(new CustomEvent("earth-online-export", { bubbles: true }));
  });
  panel.querySelector(".import-button input").addEventListener("change", (event) => {
    const [file] = event.currentTarget.files || [];

    if (file) {
      panel.dispatchEvent(new CustomEvent("earth-online-import", {
        bubbles: true,
        detail: file,
      }));
    }
  });

  if (allowTaskCompletion) {
    for (const button of panel.querySelectorAll("[data-task-id]")) {
      button.addEventListener("click", () => {
        const currentTask = daily.tasks.find((task) => task?.id === button.dataset.taskId);
        const nextSave = completePanelTask(activeSave, button.dataset.taskId);

        if (nextSave !== activeSave) {
          root.dataset.lastSyncedTaskId = button.dataset.taskId;
          root.dataset.systemMessage = getTaskCompletionMessage(currentTask);
          onChange?.(nextSave);
        }
      });
    }
  }

  root.append(panel);

  if (daily.changed) {
    queueMicrotask(() => onChange?.(activeSave));
  }

  if (lastSyncedTaskId) {
    globalThis.setTimeout?.(() => {
      if (root.dataset.lastSyncedTaskId === lastSyncedTaskId) {
        delete root.dataset.lastSyncedTaskId;
      }
    }, 1200);
  }
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
