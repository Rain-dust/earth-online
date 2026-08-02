import { readLocalSaveSnapshot } from "../src/core/storage.mjs";
import { createEarthScene } from "../src/scene/earth-scene.mjs";

const FALLBACK_LOCATION = Object.freeze({
  city: "上海",
  country: "中国",
  latitude: 31.2304,
  longitude: 121.4737,
});

const VARIANTS = new Set(["beacon", "lock", "city"]);

const study = document.querySelector("#anchor-study");
const stage = document.querySelector("#earth-stage");
const layer = document.querySelector("#signal-layer");
const signal = document.querySelector("#player-signal");
const identity = document.querySelector(".signal-identity");
const cityName = document.querySelector("#city-name");
const identityState = document.querySelector("#identity-state");
const coordinates = document.querySelector("#city-coordinates");
const variantButtons = [...document.querySelectorAll("[data-variant-select]")];

const saveResult = readLocalSaveSnapshot();
const savedLocation = saveResult.status === "found"
  ? saveResult.save?.profile?.location
  : null;
const playerLocation = isValidLocation(savedLocation)
  ? savedLocation
  : FALLBACK_LOCATION;

const scene = createEarthScene(stage);
let activeVariant = getInitialVariant();
let projection = null;
let triggerTimer = null;

cityName.textContent = playerLocation.city || "玩家城市";
coordinates.textContent = formatCoordinates(playerLocation);
setVariant(activeVariant, { updateUrl: false });

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

signal.addEventListener("click", triggerSignal);
for (const button of variantButtons) {
  button.addEventListener("click", () => {
    setVariant(button.dataset.variantSelect);
    triggerSignal();
  });
}

window.addEventListener("beforeunload", () => {
  clearTimeout(triggerTimer);
  unsubscribeProjection();
  scene.stop();
}, { once: true });

function setVariant(variant, { updateUrl = true } = {}) {
  activeVariant = VARIANTS.has(variant) ? variant : "beacon";
  study.dataset.variant = activeVariant;
  identityState.textContent = {
    beacon: "玩家信号",
    lock: "玩家坐标已确认",
    city: "城市在线",
  }[activeVariant];
  for (const button of variantButtons) {
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.variantSelect === activeVariant),
    );
  }
  renderProjection();

  if (updateUrl) {
    const url = new URL(window.location.href);
    url.searchParams.set("variant", activeVariant);
    history.replaceState(null, "", url);
  }
}

function renderProjection() {
  if (!projection?.visible) {
    signal.classList.remove("is-visible");
    identity.classList.remove("is-visible");
    return;
  }

  signal.style.left = `${projection.x}px`;
  signal.style.top = `${projection.y}px`;
  signal.classList.add("is-visible");

  const mobile = layer.clientWidth <= 720;
  if (mobile) {
    identity.style.left = `${projection.x}px`;
    identity.style.top = `${projection.y + 70}px`;
    identity.style.transform = "translate3d(-50%, 0, 0)";
    identity.classList.remove("opens-left");
    identity.classList.add("is-visible");
    return;
  }

  const identityOffsetX = mobile ? 43 : 48;
  const openLeft = projection.x > layer.clientWidth * 0.62;
  const identityOffset = activeVariant === "city" ? identityOffsetX + 16 : identityOffsetX + 26;
  identity.style.left = `${projection.x + (openLeft ? -identityOffset : identityOffset)}px`;
  identity.style.top = `${projection.y + (activeVariant === "city" ? 42 : 4)}px`;
  identity.style.transform = openLeft
    ? "translate3d(-100%, -50%, 0)"
    : "translate3d(0, -50%, 0)";
  identity.classList.toggle("opens-left", openLeft);
  identity.classList.add("is-visible");
}

function triggerSignal() {
  clearTimeout(triggerTimer);
  signal.classList.remove("is-triggered");
  void signal.offsetWidth;
  signal.classList.add("is-triggered");
  triggerTimer = window.setTimeout(() => {
    signal.classList.remove("is-triggered");
  }, 760);
}

function getInitialVariant() {
  const requested = new URLSearchParams(window.location.search).get("variant");
  return VARIANTS.has(requested) ? requested : "beacon";
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
