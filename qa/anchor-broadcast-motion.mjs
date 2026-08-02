import { resolveSystemBroadcast } from "../src/core/system-broadcast-resolver.mjs";
import { readLocalSaveSnapshot } from "../src/core/storage.mjs";
import { createEarthScene } from "../src/scene/earth-scene.mjs";
import { buildSignalLinkPath } from "../src/ui/signal-link-overlay.mjs";
import { getSystemBroadcastMarkup } from "../src/ui/system-broadcast.mjs";

const FALLBACK_LOCATION = Object.freeze({
  city: "上海",
  country: "中国",
  latitude: 31.2304,
  longitude: 121.4737,
});

const study = document.querySelector("#anchor-broadcast-study");
const stage = document.querySelector("#earth-stage");
const layer = document.querySelector("#signal-layer");
const signal = document.querySelector("#player-signal");
const identity = document.querySelector("#signal-identity");
const cityName = document.querySelector("#city-name");
const coordinates = document.querySelector("#city-coordinates");
const studyTitle = document.querySelector("#study-title");
const link = document.querySelector("#broadcast-link");
const path = document.querySelector("#broadcast-path");
const packet = document.querySelector("#signal-packet");
const broadcastRoot = document.querySelector("#broadcast-root");
const note = document.querySelector("#study-note");

const saveResult = readLocalSaveSnapshot();
const save = saveResult.status === "found" ? saveResult.save : {};
const savedLocation = save?.profile?.location;
const hasPlayerLocation = isValidLocation(savedLocation);
const isPreview = saveResult.status !== "found" || !hasPlayerLocation;
const playerLocation = hasPlayerLocation ? savedLocation : FALLBACK_LOCATION;
const previousLastActiveAt = save?.connection?.lastActiveAt || null;
const broadcast = resolveSystemBroadcast(save, { previousLastActiveAt });

const scene = createEarthScene(stage);
let projection = null;
let phase = "idle";
let phaseTimer = null;
let packetFrame = null;
let autoplayTimer = null;

cityName.textContent = playerLocation.city || "玩家城市";
coordinates.textContent = formatCoordinates(playerLocation);
study.dataset.preview = String(isPreview);
if (saveResult.status === "failed") {
  studyTitle.textContent = "本地存档读取失败";
  broadcastRoot.innerHTML = getStorageErrorMarkup();
} else if (isPreview) {
  studyTitle.textContent = "视觉预览 · 演示坐标";
  broadcastRoot.innerHTML = getPreviewBroadcastMarkup();
} else {
  broadcastRoot.innerHTML = getSystemBroadcastMarkup(broadcast);
}

scene.start();
await scene.focusLocation(playerLocation, {
  reducedMotion: prefersReducedMotion(),
  duration: prefersReducedMotion() ? 0 : 850,
});

const unsubscribeProjection = scene.subscribeLocationProjection(
  playerLocation,
  (nextProjection) => {
    projection = nextProjection;
    renderProjection();
  },
);

signal.addEventListener("click", startTransmission);
broadcastRoot.addEventListener("click", handleBroadcastAction);
window.addEventListener("resize", renderProjection);

if (new URLSearchParams(window.location.search).get("autoplay") === "1") {
  autoplayTimer = window.setTimeout(startTransmission, 1150);
}

window.addEventListener("beforeunload", destroy, { once: true });

function renderProjection() {
  if (!projection?.visible) {
    signal.classList.remove("is-visible");
    identity.classList.remove("is-visible");
    link.hidden = true;
    return;
  }

  link.hidden = false;
  signal.style.left = `${projection.x}px`;
  signal.style.top = `${projection.y}px`;
  signal.classList.add("is-visible");

  positionIdentity();
  positionBroadcast();
  updateSignalPath();
}

function positionIdentity() {
  const mobile = layer.clientWidth <= 720;
  if (mobile) {
    identity.style.left = `${projection.x}px`;
    identity.style.top = `${projection.y + 70}px`;
    identity.style.transform = "translate3d(-50%, 0, 0)";
    identity.classList.remove("opens-left");
    identity.classList.add("is-visible");
    return;
  }

  const openLeft = projection.x > layer.clientWidth * 0.62;
  const offset = 74;
  identity.style.left = `${projection.x + (openLeft ? -offset : offset)}px`;
  identity.style.top = `${projection.y + 4}px`;
  identity.style.transform = openLeft
    ? "translate3d(-100%, -50%, 0)"
    : "translate3d(0, -50%, 0)";
  identity.classList.toggle("opens-left", openLeft);
  identity.classList.add("is-visible");
}

function positionBroadcast() {
  const width = layer.clientWidth;
  const height = layer.clientHeight;
  const mobile = width <= 720;

  if (mobile) {
    broadcastRoot.classList.remove("opens-left");
    broadcastRoot.style.top = `${clamp(projection.y + 155, 520, height - 250)}px`;
    broadcastRoot.style.left = "";
    return;
  }

  const opensLeft = projection.x > width * 0.57;
  const top = clamp(projection.y - 118, 150, height - 300);
  const targetWidth = Math.min(390, width * 0.36);
  const left = opensLeft
    ? Math.max(46, projection.x - targetWidth - 210)
    : Math.min(width - targetWidth - 46, projection.x + 210);

  broadcastRoot.classList.toggle("opens-left", opensLeft);
  broadcastRoot.style.left = `${left}px`;
  broadcastRoot.style.top = `${top}px`;
}

function updateSignalPath() {
  if (!projection?.visible) return;

  const rootRect = study.getBoundingClientRect();
  const targetRect = broadcastRoot.getBoundingClientRect();
  const mobile = layer.clientWidth <= 720;
  const opensLeft = broadcastRoot.classList.contains("opens-left");
  const source = {
    x: projection.x,
    y: projection.y,
  };
  const target = mobile
    ? {
        x: targetRect.left - rootRect.left + 10,
        y: targetRect.top - rootRect.top - 18,
      }
    : {
        x: (opensLeft ? targetRect.right : targetRect.left) - rootRect.left,
        y: targetRect.top - rootRect.top + 20,
      };

  path.setAttribute("d", buildSignalLinkPath(source, target));
  const length = Math.max(1, path.getTotalLength());
  path.style.setProperty("--signal-length", String(length));
  path.dataset.length = String(length);
  packet.setAttribute("cx", String(source.x));
  packet.setAttribute("cy", String(source.y));
}

function startTransmission() {
  if (phase !== "idle" || !projection?.visible) return;

  clearTimers();
  setPhase("transmitting");
  signal.setAttribute("aria-expanded", "true");
  animatePacket();

  phaseTimer = window.setTimeout(() => {
    setPhase("broadcast");
    note.textContent = "系统播报已送达。";
  }, prefersReducedMotion() ? 40 : 760);
}

function animatePacket() {
  const length = Number(path.dataset.length);
  if (!Number.isFinite(length) || length <= 0 || prefersReducedMotion()) return;

  const startedAt = performance.now() + 130;
  packet.style.opacity = "0";

  const draw = (now) => {
    if (phase !== "transmitting") {
      packet.style.opacity = "0";
      return;
    }

    const progress = clamp((now - startedAt) / 560, 0, 1);
    if (progress > 0) {
      const point = path.getPointAtLength(length * progress);
      packet.setAttribute("cx", String(point.x));
      packet.setAttribute("cy", String(point.y));
      packet.style.opacity = String(Math.sin(progress * Math.PI));
    }

    if (progress < 1) {
      packetFrame = requestAnimationFrame(draw);
    } else {
      packet.style.opacity = "0";
    }
  };

  packetFrame = requestAnimationFrame(draw);
}

function handleBroadcastAction(event) {
  const action = event.target?.closest?.("[data-broadcast-action]");
  if (!action || phase !== "broadcast") return;

  setPhase("closing");
  signal.setAttribute("aria-expanded", "false");
  phaseTimer = window.setTimeout(() => {
    setPhase("idle");
    note.textContent = "点击玩家坐标，接收当前系统播报。";
  }, prefersReducedMotion() ? 20 : 320);
}

function setPhase(nextPhase) {
  phase = nextPhase;
  study.dataset.phase = nextPhase;
  const broadcastAvailable = nextPhase === "broadcast";
  broadcastRoot.toggleAttribute("inert", !broadcastAvailable);
  broadcastRoot.setAttribute("aria-hidden", String(!broadcastAvailable));
}

function clearTimers() {
  clearTimeout(phaseTimer);
  clearTimeout(autoplayTimer);
  cancelAnimationFrame(packetFrame);
  phaseTimer = null;
  autoplayTimer = null;
  packetFrame = null;
}

function destroy() {
  clearTimers();
  unsubscribeProjection();
  signal.removeEventListener("click", startTransmission);
  broadcastRoot.removeEventListener("click", handleBroadcastAction);
  window.removeEventListener("resize", renderProjection);
  scene.stop();
}

function isValidLocation(location) {
  return location
    && Number.isFinite(Number(location.latitude))
    && Number.isFinite(Number(location.longitude));
}

function formatCoordinates(location) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const latitudeLabel = `${Math.abs(latitude).toFixed(2)} ${latitude >= 0 ? "N" : "S"}`;
  const longitudeLabel = `${Math.abs(longitude).toFixed(2)} ${longitude >= 0 ? "E" : "W"}`;
  return `${latitudeLabel} · ${longitudeLabel}`;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getPreviewBroadcastMarkup() {
  return `
    <div class="system-broadcast" data-broadcast-type="visual_preview" aria-live="polite">
      <div class="broadcast-copy">
        <p class="broadcast-kicker">视觉样片 / 演示坐标</p>
        <h2>地球已找到一条玩家信号</h2>
        <p class="broadcast-distance">信号来自：中国 · 上海</p>
        <p class="broadcast-status">坐标通信已建立。<br />当前没有新的系统事件。</p>
      </div>
      <div class="broadcast-actions" aria-label="系统回应">
        <button type="button" data-broadcast-action="continue">收起播报</button>
      </div>
    </div>
  `;
}

function getStorageErrorMarkup() {
  return `
    <div class="system-broadcast" data-broadcast-type="storage_error" aria-live="assertive">
      <div class="broadcast-copy">
        <p class="broadcast-kicker">LOCAL SAVE / READ FAILED</p>
        <h2>无法读取本地玩家存档</h2>
        <p class="broadcast-status">系统没有生成玩家播报。</p>
      </div>
      <div class="broadcast-actions" aria-label="系统回应">
        <button type="button" data-broadcast-action="continue">收起提示</button>
      </div>
    </div>
  `;
}
