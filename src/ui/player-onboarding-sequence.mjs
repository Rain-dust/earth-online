import {
  finalizePlayerOnboarding,
  normalizeOnboarding,
  recordOnboardingAnswer,
  skipOnboardingStep,
} from "../core/player-profile.mjs";
import { loadLocationIndex } from "../core/location-index.mjs";
import { formatLocationRecord } from "../core/player-location.mjs";
import { renderLocationSelector } from "./location-selector.mjs";
import { revealText } from "./text-reveal.mjs";

const STEP_FEEDBACK = Object.freeze({
  player_name: "区域信号已稳定",
  location: "玩家位置锚点已建立",
  main_quest: "主线轨迹已建立",
});

export function getOnboardingSummary(save = {}) {
  const onboarding = normalizeOnboarding(save.onboarding, {
    hasProfile: Boolean(save.profile),
  });
  const draft = onboarding.draft;
  const identityCount = [
    draft.nickname,
    draft.lifeStage,
    draft.birthday,
    draft.zodiac,
    draft.mbti?.value,
  ].filter(Boolean).length;

  return {
    identityCount,
    questCount: draft.mainQuest ? 1 : 0,
    historyCount: 0,
  };
}

export function getPlayerOnboardingMarkup(save = {}, { error = "" } = {}) {
  const onboarding = normalizeOnboarding(save.onboarding, {
    hasProfile: Boolean(save.profile),
  });
  const step = onboarding.lastStep;

  return `
    <div class="player-onboarding-sequence" data-onboarding-step="${escapeHtml(step)}">
      <button class="onboarding-exit" type="button" data-action="exit" aria-label="返回地球首页">×</button>
      <div class="onboarding-copy">
        <p class="onboarding-kicker">玩家存档恢复</p>
        ${renderStep(step)}
        ${error ? `<p class="onboarding-error" role="alert">${escapeHtml(error)}</p>` : ""}
      </div>
    </div>
  `;
}

export function renderPlayerOnboardingSequence(root, {
  save,
  onSave = () => {},
  onComplete = () => {},
  onExit = () => {},
  onFeedback = () => {},
  loadLocations = loadLocationIndex,
  reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false,
  nowFactory = () => new Date().toISOString(),
} = {}) {
  let active = true;
  let locked = false;
  let currentSave = save;
  let error = "";
  let completionBlocked = false;
  let childCleanup = null;
  let revealController = null;
  const lifecycle = new AbortController();

  root.classList?.add("is-onboarding");

  const complete = async () => {
    if (!active) return;
    locked = true;
    const completedSave = finalizePlayerOnboarding(currentSave, nowFactory());
    const persisted = await onSave(completedSave);
    currentSave = persisted && typeof persisted === "object" ? persisted : completedSave;
    active = false;
    lifecycle.abort();
    revealController?.abort();
    childCleanup?.();
    childCleanup = null;
    root.classList?.remove("is-onboarding");
    onComplete(currentSave);
  };

  const persist = async (nextSave, step, value, skipped = false) => {
    if (locked || !active) return;
    locked = true;
    const persisted = await onSave(nextSave);
    currentSave = persisted && typeof persisted === "object" ? persisted : nextSave;
    error = "";
    const message = getOnboardingFeedbackMessage(step, currentSave, { value, skipped });
    renderFeedback(step, message, skipped);

    await onFeedback({
      step,
      skipped,
      message,
      value,
      save: currentSave,
      source: root.querySelector?.("[data-onboarding-feedback]"),
      signal: lifecycle.signal,
      reducedMotion,
    });
    if (!active) return;

    locked = false;
    if (normalizeOnboarding(currentSave.onboarding).lastStep === "complete") {
      try {
        await complete();
      } catch (caught) {
        handleCompletionFailure(caught);
      }
      return;
    }
    render();
  };

  const answer = async (step, value) => {
    if (locked || !active) return;
    try {
      await persist(
        recordOnboardingAnswer(currentSave, step, value, nowFactory()),
        step,
        value,
      );
    } catch (caught) {
      if (!active || caught?.name === "AbortError") return;
      locked = false;
      error = caught instanceof Error ? caught.message : "这条记录暂时无法写入";
      render();
    }
  };

  const skip = async (step) => {
    if (locked || !active) return;
    try {
      await persist(skipOnboardingStep(currentSave, step), step, null, true);
    } catch (caught) {
      if (!active || caught?.name === "AbortError") return;
      locked = false;
      error = caught instanceof Error ? caught.message : "暂时无法跳过这一项";
      render();
    }
  };

  const bindClick = (selector, callback) => {
    for (const element of root.querySelectorAll(selector)) {
      element.addEventListener("click", callback);
    }
  };

  const bindForm = (selector, callback) => {
    const form = root.querySelector(selector);
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      callback(form);
    });
  };

  function render() {
    if (!active) return;

    childCleanup?.();
    childCleanup = null;
    revealController?.abort();
    revealController = new AbortController();

    const onboarding = normalizeOnboarding(currentSave.onboarding, {
      hasProfile: Boolean(currentSave.profile),
    });
    if (
      onboarding.lastStep === "complete"
      && onboarding.status !== "complete"
      && !completionBlocked
    ) {
      void complete().catch(handleCompletionFailure);
      return;
    }

    root.innerHTML = getPlayerOnboardingMarkup(currentSave, { error });

    bindClick("[data-action='exit']", () => {
      cleanup();
      onExit();
    });

    bindClick("[data-action='skip']", (event) => {
      void skip(event.currentTarget.dataset.step);
    });

    bindClick("[data-action='retry-completion']", () => {
      completionBlocked = false;
      void complete().catch(handleCompletionFailure);
    });

    bindClick("[data-action='choose-location']", () => {
      if (locked) return;
      revealController?.abort();
      childCleanup = renderLocationSelector(root, {
        loadLocations,
        onConfirm: (candidate) => answer("location", candidate),
        onExit: render,
      });
    });

    bindForm("[data-form='player_name']", (form) => {
      void answer("player_name", form.elements.namedItem("playerName")?.value);
    });

    bindForm("[data-form='main_quest']", (form) => {
      void answer("main_quest", form.elements.namedItem("mainQuest")?.value);
    });

    const question = root.querySelector?.("[data-onboarding-question]");
    if (question) {
      revealText(question, question.textContent, {
        signal: revealController.signal,
        reducedMotion,
      });
    }
  }

  function renderFeedback(step, message, skipped) {
    childCleanup?.();
    childCleanup = null;
    revealController?.abort();
    root.innerHTML = `
      <div class="player-onboarding-sequence is-writing-back" data-onboarding-step="${escapeHtml(step)}">
        <div class="onboarding-copy">
          <p class="onboarding-kicker">${skipped ? "玩家选择已记录" : STEP_FEEDBACK[step] || "玩家记录已写入"}</p>
          <h2 data-onboarding-feedback>${escapeHtml(message)}</h2>
        </div>
      </div>
    `;
  }

  function handleCompletionFailure(caught) {
    if (!active || caught?.name === "AbortError") return;
    locked = false;
    completionBlocked = true;
    error = caught instanceof Error ? caught.message : "玩家存档暂时无法建立";
    render();
  }

  function cleanup() {
    if (!active) return;
    active = false;
    locked = true;
    lifecycle.abort();
    revealController?.abort();
    childCleanup?.();
    childCleanup = null;
    root.classList?.remove("is-onboarding");
  }

  render();
  return cleanup;
}

export function getOnboardingFeedbackMessage(step, save, { skipped = false } = {}) {
  if (skipped) return "已按你的选择跳过这一项。";
  const draft = normalizeOnboarding(save?.onboarding, {
    hasProfile: Boolean(save?.profile),
  }).draft;
  if (step === "player_name") return `玩家 ${draft.nickname || ""} 已确认。`;
  if (step === "location") {
    return `玩家位置锚点已建立。\n${formatLocationRecord(draft.location)}`;
  }
  if (step === "main_quest") return `主线已开始追踪。\n「${draft.mainQuest || ""}」`;
  return "玩家记录已写入。";
}

function renderStep(step) {
  if (step === "player_name") {
    return `
      <h2 data-onboarding-question>这份存档应如何称呼你？</h2>
      <form class="onboarding-entry" data-form="player_name">
        <label for="onboarding-player-name">玩家名称</label>
        <input id="onboarding-player-name" name="playerName" maxlength="16" autocomplete="nickname" autofocus />
        <button type="submit">确认名称</button>
      </form>
    `;
  }

  if (step === "location") {
    return `
      <h2 data-onboarding-question>选择一座城市建立玩家信号锚点。</h2>
      <div class="onboarding-options">
        <button type="button" data-action="choose-location">搜索城市</button>
      </div>
    `;
  }

  if (step === "main_quest") {
    return `
      <h2 data-onboarding-question>目前有一件正在持续推进的事吗？</h2>
      <form class="onboarding-entry" data-form="main_quest">
        <label for="onboarding-main-quest">当前主线</label>
        <input id="onboarding-main-quest" name="mainQuest" maxlength="80" />
        <button type="submit">开始追踪</button>
      </form>
      ${renderSkip("main_quest", "暂时没有")}
    `;
  }

  return `
    <h2 data-onboarding-question>玩家存档暂时无法完成。</h2>
    <button class="onboarding-skip" type="button" data-action="retry-completion">重新尝试</button>
  `;
}

function renderSkip(step, label) {
  return `<button class="onboarding-skip" type="button" data-action="skip" data-step="${step}">${label}</button>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
