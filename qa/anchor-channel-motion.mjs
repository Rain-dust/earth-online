import { readLocalSaveSnapshot } from "../src/core/storage.mjs";
import { createEarthScene } from "../src/scene/earth-scene.mjs";

const FALLBACK_LOCATION = Object.freeze({
  id: "cn-shanghai",
  city: "上海",
  country: "中国",
  latitude: 31.2304,
  longitude: 121.4737,
});

const prototype = document.querySelector(".motion-prototype");
const stage = document.querySelector("#globe-stage");
const layer = document.querySelector("#motion-layer");
const anchor = document.querySelector("#anchor-control");
const locationLabel = document.querySelector("#location-label");
const cluster = document.querySelector(".channel-cluster");
const content = document.querySelector(".channel-content");
const primaryPath = document.querySelector(".signal-path-primary");
const secondaryPath = document.querySelector(".signal-path-secondary");
const signalGate = document.querySelector(".signal-gate");
const variantButtons = [...document.querySelectorAll("[data-variant-select]")];
const channelButtons = [...document.querySelectorAll("[data-channel]")];
const contentClose = document.querySelector(".content-close");
const motionClose = document.querySelector("[data-motion-close]");

const saveResult = readLocalSaveSnapshot();
const savedLocation = saveResult.status === "found"
  ? saveResult.save?.profile?.location
  : null;
const playerLocation = isValidLocation(savedLocation) ? savedLocation : FALLBACK_LOCATION;
const scene = createEarthScene(stage);

let projection = null;
let isOpen = false;
let selectedChannel = "";
let activeVariant = getInitialVariant();
let autoTimer = null;

locationLabel.textContent = `${playerLocation.city || "玩家城市"}节点`;
scene.start();
scene.setPlayerLocation(playerLocation);
await scene.focusLocation(playerLocation, {
  reducedMotion: prefersReducedMotion(),
  duration: prefersReducedMotion() ? 0 : 900,
});
scene.pulsePlayerSignal({
  duration: prefersReducedMotion() ? 0 : 800,
  reducedMotion: prefersReducedMotion(),
  variant: "identity",
});

const unsubscribeProjection = scene.subscribeLocationProjection(playerLocation, (nextProjection) => {
  const stageRect = stage.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  projection = nextProjection?.visible ? {
    x: nextProjection.x + stageRect.left - layerRect.left,
    y: nextProjection.y + stageRect.top - layerRect.top,
    visible: true,
  } : null;
  renderGeometry();
});

setVariant(activeVariant);
anchor.addEventListener("click", () => {
  if (isOpen) {
    closeChannels();
  } else {
    openChannels();
  }
});

for (const button of variantButtons) {
  button.addEventListener("click", () => {
    setVariant(button.dataset.variantSelect);
  });
}

for (const button of channelButtons) {
  button.addEventListener("click", () => {
    selectChannel(button.dataset.channel);
  });
}

contentClose.addEventListener("click", clearSelection);
motionClose.addEventListener("click", closeChannels);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeChannels();
});
window.addEventListener("beforeunload", () => {
  clearTimeout(autoTimer);
  unsubscribeProjection();
  scene.stop();
}, { once: true });

if (new URLSearchParams(window.location.search).get("autoplay") === "1") {
  autoTimer = window.setTimeout(openChannels, 900);
  window.setTimeout(() => selectChannel("task"), 2100);
}

function setVariant(variant) {
  activeVariant = variant === "b" ? "b" : "a";
  prototype.dataset.variant = activeVariant;
  for (const button of variantButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.variantSelect === activeVariant),
    );
  }
  closeChannels();
  const url = new URL(window.location.href);
  url.searchParams.set("variant", activeVariant);
  history.replaceState(null, "", url);
}

function openChannels() {
  if (!projection?.visible) return;
  isOpen = true;
  selectedChannel = "";
  layer.classList.add("is-open");
  layer.classList.remove("has-selection");
  anchor.setAttribute("aria-expanded", "true");
  applyEarthShift();
  renderGeometry();
}

function closeChannels() {
  isOpen = false;
  selectedChannel = "";
  layer.classList.remove("is-open", "has-selection");
  anchor.setAttribute("aria-expanded", "false");
  resetEarthShift();
  renderGeometry();
}

function selectChannel(channel) {
  if (!isOpen) return;
  selectedChannel = channel || "task";
  layer.classList.add("has-selection");
  renderGeometry();
}

function clearSelection() {
  selectedChannel = "";
  layer.classList.remove("has-selection");
  renderGeometry();
}

function renderGeometry() {
  if (!projection) {
    anchor.classList.remove("is-visible");
    return;
  }

  anchor.classList.add("is-visible");
  anchor.style.left = `${projection.x}px`;
  anchor.style.top = `${projection.y}px`;

  const viewport = {
    width: layer.clientWidth,
    height: layer.clientHeight,
  };
  const layout = getInteractionLayout(projection, viewport, activeVariant);

  primaryPath.setAttribute("d", layout.primaryPath);
  secondaryPath.setAttribute("d", layout.secondaryPath);
  signalGate.setAttribute("cx", String(layout.gate.x));
  signalGate.setAttribute("cy", String(layout.gate.y));

  cluster.style.left = `${layout.cluster.x}px`;
  cluster.style.top = `${layout.cluster.y}px`;
  content.style.left = `${layout.content.x}px`;
  content.style.top = `${layout.content.y}px`;

  const presence = document.querySelector(".player-presence");
  presence.style.left = `${projection.x}px`;
  presence.style.top = `${projection.y}px`;

  layer.dataset.direction = layout.direction;
  layer.dataset.selectedChannel = selectedChannel;
}

function applyEarthShift() {
  if (activeVariant !== "b") {
    resetEarthShift();
    return;
  }

  const mobile = layer.clientWidth <= 720;
  const openRight = projection.x < layer.clientWidth * 0.56;
  prototype.style.setProperty(
    "--earth-shift-x",
    mobile ? "0px" : openRight ? "-6vw" : "6vw",
  );
  prototype.style.setProperty("--earth-shift-y", "0px");
}

function resetEarthShift() {
  prototype.style.setProperty("--earth-shift-x", "0px");
  prototype.style.setProperty("--earth-shift-y", "0px");
}

function getInteractionLayout(source, viewport, variant) {
  const mobile = viewport.width <= 720;
  const openRight = mobile || source.x < viewport.width * 0.56;
  const direction = mobile ? "down" : openRight ? "right" : "left";
  const edgePadding = mobile ? 24 : 54;
  const target = mobile
    ? {
        x: clamp(source.x + 24, edgePadding, viewport.width - 174),
        y: clamp(source.y + 190, viewport.height * 0.58, viewport.height - 185),
      }
    : {
        x: openRight
          ? clamp(source.x + viewport.width * 0.25, source.x + 170, viewport.width - 210)
          : clamp(source.x - viewport.width * 0.25, 210, source.x - 170),
        y: clamp(source.y - 58, 170, viewport.height - 250),
      };
  const sign = direction === "left" ? -1 : 1;
  const gate = mobile
    ? {
        x: source.x + (target.x - source.x) * 0.38,
        y: source.y + Math.max(78, (target.y - source.y) * 0.42),
      }
    : {
        x: source.x + sign * Math.max(88, Math.abs(target.x - source.x) * 0.48),
        y: source.y + (target.y - source.y) * 0.34,
      };
  const split = variant === "b";
  const primaryEnd = split ? gate : target;
  const primaryPath = curvePath(source, primaryEnd, direction, split ? 0.16 : 0.3);
  const secondaryPath = split
    ? curvePath(gate, target, direction, 0.18)
    : `M ${target.x} ${target.y} L ${target.x} ${target.y}`;
  const clusterX = direction === "left" ? target.x - 154 : target.x + 5;
  const clusterY = mobile ? target.y - 72 : target.y - 70;
  const contentX = mobile
    ? edgePadding
    : direction === "left"
      ? clamp(target.x - 420, edgePadding, viewport.width - 430)
      : clamp(target.x + 18, edgePadding, viewport.width - 430);
  const contentY = mobile
    ? clamp(target.y - 24, viewport.height * 0.54, viewport.height - 235)
    : clamp(target.y - 84, 150, viewport.height - 300);

  return {
    direction,
    target,
    gate,
    primaryPath,
    secondaryPath,
    cluster: { x: clusterX, y: clusterY },
    content: { x: contentX, y: contentY },
  };
}

function curvePath(start, end, direction, bendFactor) {
  if (direction === "down") {
    const bend = Math.max(38, Math.abs(end.y - start.y) * bendFactor);
    return [
      `M ${round(start.x)} ${round(start.y)}`,
      `C ${round(start.x - bend)} ${round(start.y + bend)}`,
      `${round(end.x - bend * 0.45)} ${round(end.y - bend)}`,
      `${round(end.x)} ${round(end.y)}`,
    ].join(" ");
  }

  const sign = direction === "left" ? -1 : 1;
  const bend = Math.max(42, Math.abs(end.x - start.x) * bendFactor);
  return [
    `M ${round(start.x)} ${round(start.y)}`,
    `C ${round(start.x + sign * bend)} ${round(start.y - 30)}`,
    `${round(end.x - sign * bend * 0.4)} ${round(end.y + 16)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

function getInitialVariant() {
  return new URLSearchParams(window.location.search).get("variant") === "b" ? "b" : "a";
}

function isValidLocation(value) {
  return value
    && Number.isFinite(Number(value.latitude))
    && Number.isFinite(Number(value.longitude));
}

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function round(value) {
  return Math.round(value * 10) / 10;
}
