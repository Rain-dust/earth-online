import { getFirstDaySequenceTimeline } from "../core/first-day-sequence.mjs";

export function getFirstDayConnectionMarkup(view = {}) {
  const location = view?.location || {};
  const achievement = view?.achievement || {};
  const task = view?.task || {};

  return `
    <div class="first-day-sequence" data-first-day-phase="idle">
      <div class="first-day-identity" aria-hidden="true">
        <strong>${escapeHtml(location.cityDisplayName || location.city || "玩家城市")}</strong>
        <span data-first-day-identity-state>玩家坐标已确认</span>
        <small>${escapeHtml(formatCoordinates(location))}</small>
      </div>

      <aside class="first-day-achievement" role="status" aria-live="polite" aria-hidden="true">
        <span class="first-day-achievement-art" aria-hidden="true">
          <img
            src="${escapeHtml(achievement.imageAsset || "./assets/achievements/link-start.png")}"
            alt=""
            width="96"
            height="96"
          />
        </span>
        <span class="first-day-achievement-copy">
          <small>成就已解锁</small>
          <strong>${escapeHtml(achievement.title || "LINK START!")}</strong>
          <span>${escapeHtml(achievement.description || "成功接入地球 Online")}</span>
          <em>${escapeHtml(achievement.rarityPercent ?? 100)}% 的玩家拥有此成就</em>
        </span>
      </aside>

      <svg
        class="first-day-daily-link"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path d="" pathLength="1"></path>
      </svg>

      <div class="first-day-daily" aria-hidden="true">
        <p><i aria-hidden="true"></i>今日信号 / 01</p>
        <h2>${escapeHtml(task.title || "正在生成今日任务")}</h2>
        <small>${escapeHtml(task.source || "地球 Online")}</small>
        <button type="button" data-first-day-action="continue">进入运行</button>
      </div>
    </div>
  `;
}

export function renderFirstDayConnectionSequence(root, {
  view,
  reducedMotion = false,
  subscribe,
  pulseAnchor = () => {},
  onPresented = () => {},
  onAchievement = () => {},
  onDailySignal = () => {},
  onContinue = () => {},
  onError = () => {},
} = {}) {
  if (!root || typeof subscribe !== "function") {
    throw new TypeError("First-day sequence requires a root and location projection");
  }

  root.classList.add("is-first-day");
  root.innerHTML = getFirstDayConnectionMarkup(view);

  const sequence = root.querySelector(".first-day-sequence");
  const identity = root.querySelector(".first-day-identity");
  const identityState = root.querySelector("[data-first-day-identity-state]");
  const achievement = root.querySelector(".first-day-achievement");
  const daily = root.querySelector(".first-day-daily");
  const dailyLink = root.querySelector(".first-day-daily-link");
  const dailyPath = root.querySelector(".first-day-daily-link path");
  const timeline = getFirstDaySequenceTimeline(reducedMotion);
  const timers = [];
  let projection = null;
  let started = false;
  let destroyed = false;
  let presented = false;

  const onClick = (event) => {
    const action = event.target?.closest?.("[data-first-day-action]");
    if (
      !action
      || sequence.dataset.firstDayPhase !== "task-live"
      || destroyed
    ) {
      return;
    }
    onContinue(action.dataset.firstDayAction);
  };

  const unsubscribe = subscribe((nextProjection) => {
    if (destroyed) return;
    projection = nextProjection;
    renderProjection();
    if (projection?.visible && !started) start();
  });

  root.addEventListener("click", onClick);

  return destroy;

  function start() {
    started = true;
    for (const stage of timeline) {
      timers.push(globalThis.setTimeout?.(() => setPhase(stage.phase), stage.at));
    }
  }

  function setPhase(nextPhase) {
    if (destroyed) return;

    sequence.dataset.firstDayPhase = nextPhase;
    achievement.setAttribute("aria-hidden", String(nextPhase !== "revealed"));
    daily.setAttribute("aria-hidden", String(nextPhase !== "task-live"));

    if (nextPhase === "revealed") {
      if (!presented) {
        presented = true;
        try {
          onPresented();
        } catch (error) {
          destroy();
          onError(error);
          return;
        }
      }
      onAchievement();
    }

    if (nextPhase === "task-ping") {
      identityState.textContent = "正在接收今日信号";
      pulseAnchor({
        reducedMotion,
        duration: reducedMotion ? 0 : 820,
        variant: "daily",
      });
      onDailySignal();
    }

    if (nextPhase === "task-live") {
      identityState.textContent = "今日信号已送达";
    }
  }

  function renderProjection() {
    if (!projection?.visible) {
      identity.classList.remove("is-visible");
      dailyPath.setAttribute("d", "");
      return;
    }

    const bounds = sequence.getBoundingClientRect();
    const mobile = bounds.width <= 700;
    const opensLeft = !mobile && projection.x > bounds.width * 0.56;
    const identityOffset = 72;

    identity.style.left = `${projection.x + (opensLeft ? -identityOffset : identityOffset)}px`;
    identity.style.top = `${projection.y + (mobile ? 66 : 3)}px`;
    identity.style.transform = mobile
      ? "translate3d(-50%, 0, 0)"
      : opensLeft
        ? "translate3d(-100%, -50%, 0)"
        : "translate3d(0, -50%, 0)";
    identity.classList.toggle("opens-left", opensLeft);
    identity.classList.add("is-visible");
    daily.classList.toggle("opens-left", opensLeft);

    if (mobile) {
      dailyPath.setAttribute("d", "");
      return;
    }

    const dailyBounds = daily.getBoundingClientRect();
    const endX = opensLeft
      ? dailyBounds.right - bounds.left
      : dailyBounds.left - bounds.left;
    const endY = dailyBounds.top - bounds.top + 17;
    const direction = opensLeft ? -1 : 1;
    const firstBendX = projection.x + (54 * direction);
    const secondBendX = endX - (38 * direction);

    dailyLink.setAttribute("viewBox", `0 0 ${bounds.width} ${bounds.height}`);
    dailyPath.setAttribute(
      "d",
      `M ${projection.x} ${projection.y} C ${firstBendX} ${projection.y}, ${secondBendX} ${endY}, ${endX} ${endY}`,
    );
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    timers.forEach((timer) => globalThis.clearTimeout?.(timer));
    unsubscribe?.();
    root.removeEventListener("click", onClick);
    root.classList.remove("is-first-day");
  }
}

function formatCoordinates(location) {
  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return "位置坐标未知";
  }

  const latitudeLabel = `${Math.abs(latitude).toFixed(2)} ${latitude >= 0 ? "N" : "S"}`;
  const longitudeLabel = `${Math.abs(longitude).toFixed(2)} ${longitude >= 0 ? "E" : "W"}`;
  return `${latitudeLabel} · ${longitudeLabel}`;
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
