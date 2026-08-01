import {
  getPlayerTerminalMarkup,
  getTaskSyncTerminalMarkup,
} from "./player-terminal.mjs";

const CHANNELS = Object.freeze([
  { id: "record", label: "记录变化" },
  { id: "quest", label: "当前主线" },
  { id: "archive", label: "夜间档案" },
]);

export function getQuietRuntimeMarkup(view = {}) {
  const activeChannel = (
    CHANNELS.some((channel) => channel.id === view.activeChannel)
    || view.activeChannel === "mission"
  )
    ? view.activeChannel
    : "";

  return `
    <div class="quiet-runtime" data-active-channel="${escapeHtml(activeChannel)}">
      ${view.enhanced === false ? `
        <p class="quiet-presence">${escapeHtml(view.playerName || "未命名玩家")} 在线 · 地球运行中</p>
      ` : `
        <div class="quiet-player-signal">
          <button type="button" class="quiet-player-name" data-player-terminal-action="open">
            <i aria-hidden="true"></i>${escapeHtml(view.playerName || "未命名玩家")}
          </button>
          <span>在线 · 地球运行中</span>
          ${renderMissionSignal(view)}
        </div>
      `}
      <div class="quiet-channels" aria-label="主动通道">
        ${CHANNELS.map((channel) => renderChannelTrigger(channel, activeChannel)).join("")}
      </div>
      ${renderDisclosure({ ...view, activeChannel })}
      ${view.terminalPhase ? getPlayerTerminalMarkup(view.playerRuntime, {
        phase: view.terminalPhase,
        feedback: view.terminalFeedback,
      }) : ""}
      ${view.taskFeedback && !view.terminalPhase
        ? getTaskSyncTerminalMarkup(view.taskFeedback)
        : ""}
    </div>
  `;
}

export function patchPlayerTerminalStatus(root, status) {
  const terminal = root.querySelector?.("[data-player-terminal]");
  if (!terminal) return false;

  const buttons = terminal.querySelectorAll?.("[data-player-status]") || [];
  let matched = false;
  for (const button of buttons) {
    const selected = button.dataset?.playerStatus === status;
    button.setAttribute?.("aria-pressed", String(selected));
    matched ||= selected;
  }
  return matched;
}

export function renderQuietRuntime(root, {
  view = {},
  onRecordChange = () => null,
  onQuestAction = () => null,
  onOpenArchive = () => {},
  onStatusChange = () => null,
  onDailyMissionAction = () => null,
  onTaskFeedbackComplete = () => {},
  subscribe = null,
} = {}) {
  let active = true;
  let state = { ...view };
  const timers = new Set();
  const unsubscribe = typeof subscribe === "function"
    ? subscribe((projection) => {
      if (!active || !projection?.visible || !root.style?.setProperty) return;
      root.style.setProperty("--player-signal-x", `${projection.x}px`);
      root.style.setProperty("--player-signal-y", `${projection.y}px`);
      root.classList?.add("has-player-signal-position");
    })
    : null;

  const render = () => {
    if (active) root.innerHTML = getQuietRuntimeMarkup(state);
  };

  const handleClick = (event) => {
    if (!active) return;

    const channel = event.target?.closest?.("[data-channel]")?.dataset.channel;
    if (channel === "archive") {
      onOpenArchive();
      return;
    }
    if (channel) {
      state = {
        ...state,
        activeChannel: state.activeChannel === channel ? "" : channel,
        questProgressOpen: false,
      };
      render();
      return;
    }

    const terminalAction = event.target?.closest?.("[data-player-terminal-action]")?.dataset.playerTerminalAction;
    if (terminalAction === "open") {
      state = { ...state, terminalPhase: "command", activeChannel: "" };
      render();
      const delay = state.terminalVisited ? 160 : 520;
      const timer = globalThis.setTimeout?.(() => {
        timers.delete(timer);
        if (!active) return;
        state = { ...state, terminalPhase: "terminal", terminalVisited: true };
        render();
        globalThis.lucide?.createIcons?.({ root });
      }, delay);
      timers.add(timer);
      return;
    }
    if (terminalAction === "close") {
      state = { ...state, terminalPhase: "", terminalFeedback: null };
      render();
      return;
    }

    const status = event.target?.closest?.("[data-player-status]")?.dataset.playerStatus;
    if (status) {
      const result = onStatusChange(status);
      state = { ...state, ...(result?.view || {}) };
      if (!patchPlayerTerminalStatus(root, state.playerRuntime?.currentStatus || status)) {
        render();
        globalThis.lucide?.createIcons?.({ root });
      }
      return;
    }

    if (event.target?.closest?.("[data-daily-mission-signal]")) {
      state = {
        ...state,
        activeChannel: state.activeChannel === "mission" ? "" : "mission",
      };
      render();
      return;
    }

    const missionAction = event.target?.closest?.("[data-daily-mission-action]")?.dataset.dailyMissionAction;
    if (missionAction) {
      const result = onDailyMissionAction(missionAction);
      state = {
        ...state,
        ...(result?.view || {}),
        activeChannel: "",
        taskFeedback: state.terminalPhase ? null : result?.feedback || null,
        terminalFeedback: state.terminalPhase ? result?.feedback || null : null,
      };
      render();
      if (result?.feedback) {
        const timer = globalThis.setTimeout?.(() => {
          timers.delete(timer);
          if (!active) return;
          state = { ...state, taskFeedback: null, terminalFeedback: null };
          render();
          onTaskFeedbackComplete(result);
        }, 3600);
        timers.add(timer);
      }
      return;
    }

    if (event.target?.closest?.("[data-quiet-action='close']")) {
      state = { ...state, activeChannel: "", questProgressOpen: false };
      render();
      return;
    }

    const questAction = event.target?.closest?.("[data-quest-action]")?.dataset.questAction;
    if (questAction === "record_progress") {
      state = { ...state, questProgressOpen: true };
      render();
      return;
    }
    if (questAction) {
      const result = onQuestAction(questAction);
      if (result?.view) state = { ...state, ...result.view };
      render();
    }
  };

  const handleSubmit = (event) => {
    if (!active) return;

    const form = event.target?.closest?.("form[data-quiet-form]");
    if (!form) return;

    event.preventDefault?.();
    const text = String(new FormData(form).get("text") || "").trim();
    if (!text) return;

    if (form.dataset.quietForm === "record") {
      const existed = state.record?.exists === true;
      const result = onRecordChange(text);
      state = {
        ...state,
        ...(result?.view || {}),
        record: result?.record || { exists: true, text },
        recordFeedback: result?.message || (
          existed ? "今日玩家记录已更新。" : "收到一条新的玩家记录。"
        ),
      };
      render();
      return;
    }

    const result = onQuestAction("record_progress", text);
    state = {
      ...state,
      ...(result?.view || {}),
      questProgressOpen: false,
      questFeedback: result?.message || "主线进度已记录。",
    };
    render();
  };

  root.classList?.add("is-quiet");
  root.addEventListener?.("click", handleClick);
  root.addEventListener?.("submit", handleSubmit);
  render();

  return function cleanup() {
    if (!active) return;
    active = false;
    timers.forEach((timer) => globalThis.clearTimeout?.(timer));
    timers.clear();
    unsubscribe?.();
    root.classList?.remove("has-player-signal-position");
    root.removeEventListener?.("click", handleClick);
    root.removeEventListener?.("submit", handleSubmit);
    root.classList?.remove("is-quiet");
  };
}

function renderChannelTrigger(channel, activeChannel) {
  const muted = Boolean(activeChannel && activeChannel !== channel.id);
  const archiveState = channel.id === "archive"
    ? " data-archive-entry"
    : "";

  return `
    <button type="button" class="quiet-channel-trigger" data-channel="${channel.id}" data-muted="${String(muted)}" aria-expanded="${String(activeChannel === channel.id)}"${archiveState}>
      ${channel.label}
    </button>
  `;
}

function renderDisclosure(view) {
  if (view.activeChannel === "record") {
    return `
      <div class="quiet-disclosure quiet-record" data-quiet-disclosure="record">
        <button type="button" class="quiet-close" data-quiet-action="close" aria-label="关闭记录变化">×</button>
        <form data-quiet-form="record">
          <label for="quiet-record-input">最近发生了什么？</label>
          <input id="quiet-record-input" name="text" maxlength="120" value="${escapeHtml(view.record?.text || "")}" required autofocus />
          <button type="submit">记录</button>
        </form>
        ${view.recordFeedback ? `<p role="status">${escapeHtml(view.recordFeedback)}</p>` : ""}
      </div>
    `;
  }

  if (view.activeChannel === "quest") {
    return renderQuestDisclosure(view);
  }

  if (view.activeChannel === "mission") {
    return renderMissionDisclosure(view);
  }

  return "";
}

function renderMissionSignal(view) {
  const mission = view.dailyMission;
  if (!mission || mission.completedAt || mission.skippedAt || !mission.acceptedAt) return "";

  return `
    <button type="button" class="quiet-daily-signal" data-daily-mission-signal aria-expanded="${String(view.activeChannel === "mission")}">
      <i aria-hidden="true"></i>今日任务运行中
    </button>
  `;
}

function renderMissionDisclosure(view) {
  const mission = view.dailyMission;
  if (!mission) return "";

  return `
    <div class="quiet-disclosure quiet-mission" data-quiet-disclosure="mission">
      <button type="button" class="quiet-close" data-quiet-action="close" aria-label="关闭每日任务">×</button>
      <p class="quiet-mission-kicker">【每日任务】</p>
      <h2>${escapeHtml(mission.content || mission.title)}</h2>
      <p>任务完成后将同步本次属性变化与临时状态。</p>
      <div class="quiet-quest-actions">
        <button type="button" data-daily-mission-action="complete">完成任务</button>
        <button type="button" data-quiet-action="close">暂不处理</button>
      </div>
    </div>
  `;
}

function renderQuestDisclosure(view) {
  if (!view.quest) {
    return `
      <div class="quiet-disclosure quiet-quest" data-quiet-disclosure="quest">
        <button type="button" class="quiet-close" data-quiet-action="close" aria-label="关闭当前主线">×</button>
        <p>当前没有正在运行的主线。</p>
      </div>
    `;
  }

  return `
    <div class="quiet-disclosure quiet-quest" data-quiet-disclosure="quest">
      <button type="button" class="quiet-close" data-quiet-action="close" aria-label="关闭当前主线">×</button>
      <h2>${escapeHtml(view.quest.name)}</h2>
      <p>上次更新：${escapeHtml(view.quest.lastProgressDistance?.text || "时间未知")}</p>
      <div class="quiet-quest-actions">
        <button type="button" data-quest-action="record_progress">记录进度</button>
        <button type="button" data-quest-action="complete">标记完成</button>
        <button type="button" data-quest-action="pause">关闭追踪</button>
      </div>
      ${view.questProgressOpen ? `
        <form data-quiet-form="quest-progress">
          <label for="quiet-quest-progress">推进了什么？</label>
          <input id="quiet-quest-progress" name="text" maxlength="100" required autofocus />
          <button type="submit">记录</button>
        </form>
      ` : ""}
      ${view.questFeedback ? `<p role="status">${escapeHtml(view.questFeedback)}</p>` : ""}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
