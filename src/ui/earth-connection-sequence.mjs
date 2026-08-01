export const CONNECTION_ROUTES = Object.freeze({
  NEW_PLAYER: "new_player",
  RETURNING_PLAYER: "returning_player",
});

const SIGNAL_INTERVAL_MS = 520;
const REDUCED_MOTION_INTERVAL_MS = 420;

export function getConnectionSignalInterval(reducedMotion = false) {
  return reducedMotion ? REDUCED_MOTION_INTERVAL_MS : SIGNAL_INTERVAL_MS;
}

export function getConnectionRoute(save = {}) {
  return save?.profile
    ? CONNECTION_ROUTES.RETURNING_PLAYER
    : CONNECTION_ROUTES.NEW_PLAYER;
}

export function getConnectionSignalMarkup(signal = {}) {
  const actions = Array.isArray(signal.actions) ? signal.actions : [];

  return `
    <div class="earth-connection-signal" data-signal="${escapeHtml(signal.id || "status")}" data-tone="${escapeHtml(signal.tone || "normal")}" aria-live="polite">
      <p>${escapeHtml(signal.text || "")}</p>
      ${actions.length > 0 ? `
        <div class="connection-signal-actions">
          ${actions.map((action) => `
            <button type="button" data-connection-action="${escapeHtml(action.id)}">${escapeHtml(action.label)}</button>
          `).join("")}
        </div>
      ` : ""}
    </div>
  `;
}

export function renderEarthConnectionSequence(root, {
  reducedMotion = false,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
  onAction = () => {},
} = {}) {
  const interval = getConnectionSignalInterval(reducedMotion);
  const pendingWaits = new Map();
  let active = true;

  const show = (signal) => {
    if (!active) return false;
    root.innerHTML = getConnectionSignalMarkup(signal);
    return true;
  };

  const handleClick = (event) => {
    if (!active) return;
    const action = event.target?.closest?.("[data-connection-action]");
    if (action) onAction(action.dataset.connectionAction);
  };

  const wait = () => new Promise((resolve) => {
    if (!active) {
      resolve(false);
      return;
    }

    const job = schedule(() => {
      pendingWaits.delete(job);
      resolve(active);
    }, interval);
    pendingWaits.set(job, resolve);
  });

  const settlePendingWaits = () => {
    for (const [job, resolve] of pendingWaits) {
      cancel(job);
      resolve(false);
    }
    pendingWaits.clear();
  };

  const deactivate = () => {
    if (!active) return false;
    active = false;
    settlePendingWaits();
    root.removeEventListener?.("click", handleClick);
    root.classList?.remove("is-connection");
    return true;
  };

  root.classList?.add("is-connection");
  root.addEventListener?.("click", handleClick);
  show({ id: "reading_save", text: "正在读取本地存档……" });

  return {
    show,
    wait,
    finish: deactivate,
    cleanup: deactivate,
    isActive: () => active,
  };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
