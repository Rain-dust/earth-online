export const CONNECTION_ROUTES = Object.freeze({
  NEW_PLAYER: "new_player",
  RETURNING_PLAYER: "returning_player",
});

const FRAME_INTERVAL_MS = 720;
const REDUCED_MOTION_INTERVAL_MS = 80;

export function getConnectionRoute(save = {}) {
  return save?.profile
    ? CONNECTION_ROUTES.RETURNING_PLAYER
    : CONNECTION_ROUTES.NEW_PLAYER;
}

export function getConnectionFrames(save = {}) {
  const route = getConnectionRoute(save);
  const sharedFrame = {
    id: "locating",
    text: "正在同步地球坐标",
  };

  if (route === CONNECTION_ROUTES.RETURNING_PLAYER) {
    const nickname = String(save.profile?.nickname || "未命名玩家").trim();
    return [
      sharedFrame,
      { id: "identified", text: `已识别：${nickname}` },
      { id: "restoring", text: "正在恢复你的运行轨道" },
    ];
  }

  return [
    sharedFrame,
    { id: "unregistered", text: "未发现可识别的本地存档" },
    { id: "creating", text: "准备建立新的玩家档案" },
  ];
}

export function getConnectionFrameMarkup(frame) {
  return `
    <div class="earth-connection-signal" data-signal="${escapeHtml(frame.id)}" aria-live="polite">
      <p>${escapeHtml(frame.text)}</p>
    </div>
  `;
}

export function renderEarthConnectionSequence(root, {
  save = {},
  onComplete = () => {},
  reducedMotion = false,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
} = {}) {
  const route = getConnectionRoute(save);
  const frames = getConnectionFrames(save);
  const interval = reducedMotion
    ? REDUCED_MOTION_INTERVAL_MS
    : FRAME_INTERVAL_MS;
  const scheduledJobs = [];
  let active = true;

  const renderFrame = (frame) => {
    if (!active) {
      return;
    }
    root.innerHTML = getConnectionFrameMarkup(frame);
  };

  root.classList?.add("is-connection");
  renderFrame(frames[0]);

  for (let index = 1; index < frames.length; index += 1) {
    scheduledJobs.push(schedule(() => renderFrame(frames[index]), index * interval));
  }

  scheduledJobs.push(schedule(() => {
    if (!active) {
      return;
    }
    active = false;
    root.classList?.remove("is-connection");
    onComplete(route);
  }, frames.length * interval));

  return function cleanupConnectionSequence() {
    if (!active) {
      return;
    }
    active = false;
    for (const job of scheduledJobs) {
      cancel(job);
    }
    root.classList?.remove("is-connection");
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
