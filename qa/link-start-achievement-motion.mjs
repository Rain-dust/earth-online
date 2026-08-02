import { readLocalSaveSnapshot } from "../src/core/storage.mjs";
import { createEarthScene } from "../src/scene/earth-scene.mjs";

const FALLBACK_LOCATION = Object.freeze({
  city: "上海",
  country: "中国",
  latitude: 31.2304,
  longitude: 121.4737,
});

const study = document.querySelector("#achievement-study");
const stage = document.querySelector("#earth-stage");
const layer = document.querySelector("#signal-layer");
const signal = document.querySelector("#player-signal");
const identity = document.querySelector("#signal-identity");
const cityName = document.querySelector("#city-name");
const coordinates = document.querySelector("#city-coordinates");
const studyTitle = document.querySelector("#study-title");
const toast = document.querySelector("#achievement-toast");

const saveResult = readLocalSaveSnapshot();
const savedLocation = saveResult.status === "found"
  ? saveResult.save?.profile?.location
  : null;
const hasPlayerLocation = isValidLocation(savedLocation);
const playerLocation = hasPlayerLocation ? savedLocation : FALLBACK_LOCATION;
const isPreview = saveResult.status !== "found" || !hasPlayerLocation;

const scene = createEarthScene(stage);
let projection = null;
let phase = "idle";
let phaseTimer = null;
let exitTimer = null;
let autoplayTimer = null;
let audioContext = null;

cityName.textContent = playerLocation.city || "玩家城市";
coordinates.textContent = formatCoordinates(playerLocation);
study.dataset.preview = String(isPreview);
if (isPreview) {
  studyTitle.textContent = "视觉预览 · 演示坐标";
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

signal.addEventListener("click", handleSignalClick);
toast.addEventListener("click", dismissUnlock);
window.addEventListener("resize", renderProjection);

if (new URLSearchParams(window.location.search).get("autoplay") === "1") {
  autoplayTimer = window.setTimeout(() => startUnlock({ withSound: false }), 1200);
}

window.addEventListener("beforeunload", destroy, { once: true });

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

function handleSignalClick() {
  startUnlock({ withSound: true });
}

function startUnlock({ withSound = false } = {}) {
  if (phase !== "idle" || !projection?.visible) return;

  clearTimers();
  setPhase("unlocking");
  if (withSound) {
    void prepareAudioContext();
  }

  phaseTimer = window.setTimeout(() => {
    setPhase("revealed");
    if (withSound) {
      playUnlockChime();
    }
    exitTimer = window.setTimeout(dismissUnlock, 4200);
  }, prefersReducedMotion() ? 30 : 540);
}

function dismissUnlock() {
  if (phase !== "revealed") return;

  clearTimeout(exitTimer);
  setPhase("leaving");
  phaseTimer = window.setTimeout(() => {
    setPhase("idle");
  }, prefersReducedMotion() ? 20 : 360);
}

function setPhase(nextPhase) {
  phase = nextPhase;
  study.dataset.phase = nextPhase;
  const visible = nextPhase === "revealed";
  toast.toggleAttribute("inert", !visible);
  toast.setAttribute("aria-hidden", String(!visible));
}

async function prepareAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return audioContext;
}

function playUnlockChime() {
  if (!audioContext || audioContext.state !== "running") return;

  const now = audioContext.currentTime;
  playTone({ frequency: 659.25, startsAt: now, duration: 0.34, gain: 0.045 });
  playTone({ frequency: 987.77, startsAt: now + 0.12, duration: 0.46, gain: 0.038 });
}

function playTone({ frequency, startsAt, duration, gain }) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  envelope.gain.setValueAtTime(0.0001, startsAt);
  envelope.gain.exponentialRampToValueAtTime(gain, startsAt + 0.025);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);

  oscillator.connect(envelope);
  envelope.connect(audioContext.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.03);
}

function clearTimers() {
  clearTimeout(phaseTimer);
  clearTimeout(exitTimer);
  clearTimeout(autoplayTimer);
  phaseTimer = null;
  exitTimer = null;
  autoplayTimer = null;
}

function destroy() {
  clearTimers();
  unsubscribeProjection();
  signal.removeEventListener("click", handleSignalClick);
  toast.removeEventListener("click", dismissUnlock);
  window.removeEventListener("resize", renderProjection);
  scene.stop();
  void audioContext?.close?.();
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
