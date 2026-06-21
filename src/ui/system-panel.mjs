import { STATUS_LABELS } from "../core/constants.mjs";
import { applyExp, unlockRuntimeAchievements } from "../core/progression.mjs";
import { completeTask, generateDailyTasks } from "../core/tasks.mjs";

const DEFAULT_NICKNAME = "未命名玩家";
const DEFAULT_TITLE = "地球 Online 观察员";
const PANEL_TAG_LIMIT = 12;

export function getDailyTasksForSave(save, today, { persistGeneratedTasks = true } = {}) {
  const dailyTasks = Array.isArray(save?.dailyTasks) ? save.dailyTasks : [];
  const todaysTasks = dailyTasks.filter((task) => task?.date === today);

  if (todaysTasks.length > 0) {
    return {
      save,
      tasks: todaysTasks,
      changed: false,
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
      ...dailyTasks,
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

export function getTaskActionState(task, { allowCompletion = true } = {}) {
  if (task?.completed) {
    return { disabled: true, label: "已完成" };
  }

  if (!allowCompletion) {
    return { disabled: true, label: "预览" };
  }

  return { disabled: false, label: "完成" };
}

export function renderSystemPanel(root, {
  save,
  onChange,
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
  const allowTaskCompletion = persistGeneratedTasks || !daily.generated;

  root.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "system-panel";
  panel.setAttribute("aria-label", "地球 Online 系统面板");
  panel.innerHTML = `
    <header class="panel-header">
      <div>
        <span class="panel-kicker">ORBITAL TERMINAL</span>
        <h2>${escapeHtml(activeSave?.profile?.nickname || DEFAULT_NICKNAME)}</h2>
        <p>${escapeHtml(getSelectedTitle(activeSave))}</p>
      </div>
      <button class="panel-exit" type="button" aria-label="退出系统面板">×</button>
    </header>

    <section class="panel-status" aria-label="玩家状态">
      <div>
        <span>STATUS</span>
        <strong>${escapeHtml(getStatusLabel(activeSave?.currentStatus))}</strong>
      </div>
      <div>
        <span>LEVEL</span>
        <strong>Lv.${escapeHtml(level.value || 1)}</strong>
      </div>
      <div class="level-progress" aria-label="等级进度">
        <div>
          <span>EXP</span>
          <strong>${escapeHtml(level.exp || 0)} / ${escapeHtml(level.nextLevelExp || 100)}</strong>
        </div>
        <meter min="0" max="100" value="${progress}"></meter>
      </div>
    </section>

    <div class="tag-strip" aria-label="玩家标签">
      ${renderTags(tags)}
    </div>

    <section class="daily-tasks" aria-label="每日任务">
      <header>
        <span>DAILY TASKS</span>
        <strong>${escapeHtml(today)}</strong>
      </header>
      <div class="task-list">
        ${daily.tasks.map((task) => renderTaskRow(task, { allowTaskCompletion })).join("")}
      </div>
    </section>

    <footer class="panel-actions">
      ${systemMessage ? `<p class="system-message" role="status">${escapeHtml(systemMessage)}</p>` : ""}
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
        const nextSave = completePanelTask(activeSave, button.dataset.taskId);

        if (nextSave !== activeSave) {
          onChange?.(nextSave);
        }
      });
    }
  }

  root.append(panel);

  if (daily.changed) {
    queueMicrotask(() => onChange?.(activeSave));
  }
}

function renderTaskRow(task, { allowTaskCompletion = true } = {}) {
  const action = getTaskActionState(task, { allowCompletion: allowTaskCompletion });

  return `
    <article class="task-row ${action.disabled ? "is-complete" : ""}">
      <span class="task-order">${escapeHtml(task?.order || "-")}</span>
      <div class="task-copy">
        <span>${escapeHtml(task?.categoryLabel || task?.category || "任务")}</span>
        <strong>${escapeHtml(task?.title || "Execute one bounded system action")}</strong>
      </div>
      <span class="task-exp">+${escapeHtml(task?.exp || 0)} EXP</span>
      <button type="button" data-task-id="${escapeHtml(task?.id || "")}" ${action.disabled ? "disabled" : ""}>
        ${escapeHtml(action.label)}
      </button>
    </article>
  `;
}

function renderTags(tags) {
  if (tags.length === 0) {
    return "<span>未配置标签</span>";
  }

  return tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
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
