import { getStatusOptions } from "./status-control.mjs";

export function getPlayerTerminalMarkup(view = {}, {
  phase = "terminal",
  feedback = null,
} = {}) {
  const playerName = String(view.playerName || "未命名玩家");
  const command = `open C:\\EarthOnline\\Players\\${playerName}`;

  if (phase === "command") {
    return `
      <div class="player-command-strip" role="status">
        <span>player@earth:~$</span>
        <strong>${escapeHtml(command)}</strong><i aria-hidden="true"></i>
      </div>
    `;
  }

  const statuses = getStatusOptions();
  return `
    <aside class="player-terminal" data-player-terminal role="dialog" aria-label="玩家运行终端">
      <header class="player-terminal-bar">
        <span class="terminal-window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>${escapeHtml(toExecutableName(playerName))}-profile.exe</span>
        <button type="button" data-player-terminal-action="close" aria-label="关闭玩家终端">×</button>
      </header>
      <div class="player-terminal-body">
        <p class="terminal-path">C:\\EarthOnline\\Players\\${escapeHtml(playerName)}</p>
        <p class="terminal-prompt"><span>player@earth</span>:~$ profile --scan <i aria-hidden="true"></i></p>
        <div class="terminal-identity">
          <small>玩家信号已确认</small>
          <strong>${escapeHtml(playerName)}</strong>
        </div>
        <div class="terminal-attributes" aria-label="玩家属性">
          ${(view.attributes || []).map(renderAttribute).join("")}
        </div>
        <div class="terminal-effects">
          <h3>当前特殊效果</h3>
          ${(view.activeEffects || []).length > 0
            ? view.activeEffects.map(renderEffect).join("")
            : `<p class="terminal-empty">当前没有临时状态。</p>`}
        </div>
        <div class="terminal-status">
          <h3>当前状态</h3>
          <div class="terminal-status-options">
            ${statuses.map((status) => `
              <button type="button" data-player-status="${status.id}" aria-pressed="${String(status.id === view.currentStatus)}">
                <i data-lucide="${status.icon}" aria-hidden="true"></i>
                <span>${escapeHtml(status.label)}</span>
              </button>
            `).join("")}
          </div>
        </div>
        ${feedback ? `<div class="terminal-inline-feedback">${getTaskFeedbackLines(feedback)}</div>` : ""}
      </div>
    </aside>
  `;
}

export function getTaskSyncTerminalMarkup(feedback = {}) {
  return `
    <aside class="task-sync-terminal" role="status" aria-live="polite">
      <header>
        <span class="terminal-window-dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <small>task-sync.exe</small>
      </header>
      <div>
        <p><span>player@earth</span>:~$ sync --today</p>
        ${getTaskFeedbackLines(feedback)}
      </div>
    </aside>
  `;
}

function renderAttribute(attribute) {
  return `
    <div class="terminal-attribute" style="--attribute-value:${Number(attribute.value) || 0}">
      <span><b>${escapeHtml(attribute.label)}</b><small>${escapeHtml(attribute.english)}</small></span>
      <i aria-hidden="true"><em></em></i>
      <strong>${Number(attribute.value) || 0}</strong>
    </div>
  `;
}

function renderEffect(effect) {
  return `
    <p class="terminal-effect">
      <strong>【${escapeHtml(effect.name)}】</strong>
      <span>剩余 ${Number(effect.remainingMinutes) || 0}min，${escapeHtml(effect.description)}</span>
    </p>
  `;
}

function getTaskFeedbackLines(feedback) {
  const changes = Array.isArray(feedback.attributeChanges) ? feedback.attributeChanges : [];
  const baseChanges = Array.isArray(feedback.baseChanges) ? feedback.baseChanges : [];
  const effect = feedback.effect || null;

  return `
    <p>&gt; 今日任务已完成。</p>
    ${changes.map((change) => `<p>&gt; ${escapeHtml(change.label)} ${change.before} → ${change.after}</p>`).join("")}
    ${baseChanges.map((change) => `
      <p class="terminal-growth">玩家长期状态发生变化。${escapeHtml(change.label)}基础值 ${change.before} → ${change.after}</p>
    `).join("")}
    ${effect ? `
      <p class="terminal-effect-result">
        玩家激活【${escapeHtml(effect.name)}】状态，持续45min，<br />
        ${escapeHtml(effect.description)}
      </p>
    ` : ""}
    ${feedback.hasAchievement ? `<p class="terminal-achievement-signal">检测到新的成就信号。</p>` : ""}
  `;
}

function toExecutableName(value) {
  return String(value || "player")
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .slice(0, 20) || "player";
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
