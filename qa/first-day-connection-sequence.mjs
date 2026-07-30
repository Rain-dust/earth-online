import { ensureDailyRun } from "../src/core/daily-run.mjs";
import { getLocalDateKey } from "../src/core/local-date.mjs";
import { readLocalSaveSnapshot } from "../src/core/storage.mjs";
import { createEarthScene } from "../src/scene/earth-scene.mjs";

const FALLBACK_LOCATION = Object.freeze({
  city: "上海",
  country: "中国",
  latitude: 31.2304,
  longitude: 121.4737,
});

const study = document.querySelector("#first-day-study");
const stage = document.querySelector("#earth-stage");
const layer = document.querySelector("#signal-layer");
const signal = document.querySelector("#player-signal");
const identity = document.querySelector("#signal-identity");
const identityState = document.querySelector("#identity-state");
const cityName = document.querySelector("#city-name");
const coordinates = document.querySelector("#city-coordinates");
const studyTitle = document.querySelector("#study-title");
const replay = document.querySelector("#sequence-replay");
const toast = document.querySelector("#achievement-toast");
const dailySignal = document.querySelector("#daily-signal");
const dailyTitle = document.querySelector("#daily-task-title");
const dailySource = document.querySelector("#daily-task-source");
const dailyLink = document.querySelector("#daily-link");
const dailyLinkPath = document.querySelector("#daily-link-path");
const searchParams = new URLSearchParams(window.location.search);

const saveResult = readLocalSaveSnapshot();
const sourceSave = saveResult.status === "found"
  ? saveResult.save
  : createPreviewSave();
const savedLocation = sourceSave?.profile?.location;
const hasPlayerLocation = isValidLocation(savedLocation);
const playerLocation = hasPlayerLocation ? savedLocation : FALLBACK_LOCATION;
const isPreview = saveResult.status !== "found" || !hasPlayerLocation;
const today = getLocalDateKey();
const dailySave = ensureDailyRun(sourceSave, today);
const dailyTask = resolveFirstDailyTask(dailySave, today);

const scene = createEarthScene(stage);
let projection = null;
let phase = "idle";
let timers = [];
let autoplayTimer = null;
let autoplayScheduled = false;
let audioContext = null;

cityName.textContent = playerLocation.city || "玩家城市";
coordinates.textContent = formatCoordinates(playerLocation);
dailyTitle.textContent = dailyTask.title;
dailySource.textContent = dailyTask.source;
study.dataset.preview = String(isPreview);
if (isPreview) {
  studyTitle.textContent = "首日连接序列 · 演示存档";
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
    scheduleAutoplayWhenReady();
  },
);

signal.addEventListener("click", handleReplay);
replay.addEventListener("click", handleReplay);
window.addEventListener("resize", renderProjection);
window.addEventListener("beforeunload", destroy, { once: true });

function handleReplay() {
  startSequence({ withSound: true });
}

function scheduleAutoplayWhenReady() {
  if (
    searchParams.get("autoplay") !== "1"
    || autoplayScheduled
    || !projection?.visible
  ) {
    return;
  }

  autoplayScheduled = true;
  autoplayTimer = window.setTimeout(
    () => startSequence({ withSound: false }),
    prefersReducedMotion() ? 20 : 620,
  );
}

function startSequence({ withSound = false } = {}) {
  if (study.dataset.running === "true" || !projection?.visible) return;

  clearTimers();
  study.dataset.running = "true";
  identityState.textContent = "玩家坐标已确认";
  setPhase("idle");
  void study.offsetWidth;

  if (withSound) {
    void prepareAudioContext();
  }

  schedule(() => {
    setPhase("unlocking");
  }, prefersReducedMotion() ? 0 : 120);

  schedule(() => {
    setPhase("revealed");
    if (withSound) playAchievementChime();
  }, prefersReducedMotion() ? 20 : 660);

  schedule(() => {
    setPhase("leaving");
  }, prefersReducedMotion() ? 50 : 3460);

  schedule(() => {
    setPhase("task-ping");
    identityState.textContent = "正在接收今日信号";
    if (withSound) playDailySignalChime();
  }, prefersReducedMotion() ? 70 : 3840);

  schedule(() => {
    identityState.textContent = "今日信号已送达";
    setPhase("task-live");
    study.dataset.running = "false";
  }, prefersReducedMotion() ? 90 : 4400);
}

function renderProjection() {
  if (!projection?.visible) {
    signal.classList.remove("is-visible");
    identity.classList.remove("is-visible");
    dailyLinkPath.setAttribute("d", "");
    return;
  }

  signal.style.left = `${projection.x}px`;
  signal.style.top = `${projection.y}px`;
  signal.classList.add("is-visible");

  const width = layer.clientWidth;
  const mobile = width <= 720;
  if (mobile) {
    identity.style.left = `${projection.x}px`;
    identity.style.top = `${projection.y + 70}px`;
    identity.style.transform = "translate3d(-50%, 0, 0)";
    identity.classList.remove("opens-left");
    identity.classList.add("is-visible");
    dailySignal.classList.remove("opens-left");
    dailyLinkPath.setAttribute("d", "");
    return;
  }

  const anchorOnRight = projection.x > width * 0.56;
  const identityOffset = 74;
  identity.style.left = `${projection.x + (anchorOnRight ? -identityOffset : identityOffset)}px`;
  identity.style.top = `${projection.y + 4}px`;
  identity.style.transform = anchorOnRight
    ? "translate3d(-100%, -50%, 0)"
    : "translate3d(0, -50%, 0)";
  identity.classList.toggle("opens-left", anchorOnRight);
  identity.classList.add("is-visible");
  dailySignal.classList.toggle("opens-left", anchorOnRight);

  renderDailyLink(anchorOnRight);
}

function renderDailyLink(opensLeft) {
  const bounds = dailySignal.getBoundingClientRect();
  const studyBounds = study.getBoundingClientRect();
  const startX = projection.x;
  const startY = projection.y;
  const endX = opensLeft
    ? bounds.right - studyBounds.left
    : bounds.left - studyBounds.left;
  const endY = bounds.top - studyBounds.top + 18;
  const direction = opensLeft ? -1 : 1;
  const firstBendX = startX + (56 * direction);
  const secondBendX = endX - (38 * direction);

  dailyLink.setAttribute("viewBox", `0 0 ${studyBounds.width} ${studyBounds.height}`);
  dailyLinkPath.setAttribute(
    "d",
    `M ${startX} ${startY} C ${firstBendX} ${startY}, ${secondBendX} ${endY}, ${endX} ${endY}`,
  );
}

function setPhase(nextPhase) {
  phase = nextPhase;
  study.dataset.phase = phase;
  const achievementVisible = phase === "revealed";
  const taskVisible = phase === "task-live";
  toast.toggleAttribute("inert", !achievementVisible);
  toast.setAttribute("aria-hidden", String(!achievementVisible));
  dailySignal.setAttribute("aria-hidden", String(!taskVisible));
}

function schedule(callback, delay) {
  const timer = window.setTimeout(callback, delay);
  timers.push(timer);
}

function clearTimers() {
  timers.forEach((timer) => clearTimeout(timer));
  timers = [];
  clearTimeout(autoplayTimer);
  autoplayTimer = null;
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

function playAchievementChime() {
  if (!canPlayAudio()) return;

  const now = audioContext.currentTime;
  playTone({ frequency: 659.25, startsAt: now, duration: 0.34, gain: 0.045 });
  playTone({ frequency: 987.77, startsAt: now + 0.12, duration: 0.46, gain: 0.038 });
}

function playDailySignalChime() {
  if (!canPlayAudio()) return;

  const now = audioContext.currentTime;
  playTone({
    frequency: 523.25,
    startsAt: now,
    duration: 0.22,
    gain: 0.025,
    oscillatorType: "triangle",
  });
  playTone({
    frequency: 783.99,
    startsAt: now + 0.1,
    duration: 0.34,
    gain: 0.022,
    oscillatorType: "triangle",
  });
}

function playTone({
  frequency,
  startsAt,
  duration,
  gain,
  oscillatorType = "sine",
}) {
  const oscillator = audioContext.createOscillator();
  const envelope = audioContext.createGain();

  oscillator.type = oscillatorType;
  oscillator.frequency.setValueAtTime(frequency, startsAt);
  envelope.gain.setValueAtTime(0.0001, startsAt);
  envelope.gain.exponentialRampToValueAtTime(gain, startsAt + 0.025);
  envelope.gain.exponentialRampToValueAtTime(0.0001, startsAt + duration);
  oscillator.connect(envelope);
  envelope.connect(audioContext.destination);
  oscillator.start(startsAt);
  oscillator.stop(startsAt + duration + 0.03);
}

function canPlayAudio() {
  return audioContext?.state === "running";
}

function resolveFirstDailyTask(save, date) {
  const run = save?.dailyRuns?.find((item) => item?.date === date);
  if (run?.mainAction?.text) {
    return {
      title: run.mainAction.text,
      source: `来自当前主线 · ${save?.mainQuest?.title || "未命名主线"}`,
    };
  }

  if (run?.maintenance?.title) {
    return {
      title: run.maintenance.title,
      source: "根据当前玩家状态生成",
    };
  }

  return {
    title: "记录今天最值得留下的一件事",
    source: "安全降级任务",
  };
}

function createPreviewSave() {
  return {
    profile: { location: FALLBACK_LOCATION },
    currentStatus: "stable_operation",
    dailyRuns: [],
    maintenancePreferences: {},
  };
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
  if (searchParams.get("motion") === "full") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function destroy() {
  clearTimers();
  unsubscribeProjection();
  signal.removeEventListener("click", handleReplay);
  replay.removeEventListener("click", handleReplay);
  window.removeEventListener("resize", renderProjection);
  scene.stop();
  void audioContext?.close?.();
}
