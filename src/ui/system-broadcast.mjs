export function getSystemBroadcastMarkup(broadcast = {}) {
  const content = broadcast?.content || {};
  const actions = Array.isArray(broadcast?.actions)
    ? broadcast.actions.slice(0, 3)
    : [];

  let message;
  if (broadcast?.type === "first_connection") {
    message = `
      <p class="broadcast-kicker">首次连接已确认</p>
      <h2>地球已找到 ${escapeHtml(content.playerName || "未命名玩家")}</h2>
      ${content.location
        ? `<p class="broadcast-status">玩家信号已在 ${escapeHtml(content.location)} 建立</p>`
        : `<p class="broadcast-status">玩家信号位置尚未建立</p>`}
      ${content.questName
        ? `<p class="broadcast-distance">当前主线：${escapeHtml(content.questName)}</p>`
        : ""}
    `;
  } else if (broadcast?.type === "active_main_quest") {
    message = `
      <p class="broadcast-kicker">当前主线仍在运行：</p>
      <h2>「${escapeHtml(content.questName || "未命名主线")}」</h2>
      <p class="broadcast-distance">上次更新：${escapeHtml(content.lastProgressDistance?.text || "时间未知")}</p>
    `;
  } else {
    message = `
      <h2>玩家 ${escapeHtml(content.playerName || "未命名玩家")}，欢迎返回。</h2>
      <p class="broadcast-distance">距离上次连接：${escapeHtml(content.connectionDistance?.text || "时间未知")}</p>
      <p class="broadcast-status">当前没有新的系统事件。<br />地球仍在正常运行。</p>
    `;
  }

  return `
    <div class="system-broadcast" data-broadcast-type="${escapeHtml(broadcast?.type || "normal_return")}" aria-live="polite">
      <div class="broadcast-copy">${message}</div>
      <div class="broadcast-actions" aria-label="系统回应">
        ${actions.map((action) => `
          <button type="button" data-broadcast-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderSystemBroadcast(root, {
  broadcast,
  onAction = () => {},
} = {}) {
  let active = true;

  const handleClick = (event) => {
    if (!active) return;

    const action = event.target?.closest?.("[data-broadcast-action]");
    if (!action) return;

    onAction(action.dataset.broadcastAction);
  };

  root.classList?.add("is-broadcast");
  root.innerHTML = getSystemBroadcastMarkup(broadcast);
  root.addEventListener?.("click", handleClick);

  return function cleanup() {
    if (!active) return;
    active = false;
    root.removeEventListener?.("click", handleClick);
    root.classList?.remove("is-broadcast");
  };
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
