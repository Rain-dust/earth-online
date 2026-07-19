import {
  LIFE_STAGE_OPTIONS,
  ZODIAC_OPTIONS,
  finalizePlayerOnboarding,
  getZodiacLabel,
  normalizeOnboarding,
  recordOnboardingAnswer,
  skipOnboardingStep,
} from "../core/player-profile.mjs";

const STEP_FEEDBACK = Object.freeze({
  player_name: "区域信号已稳定",
  life_stage: "当前运行阶段已写入",
  birthday: "年度周期已写入存档",
  zodiac_confirm: "身份标签已确认",
  mbti: "玩家标签已写入",
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
        ${renderStep(step, onboarding, save)}
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
  nowFactory = () => new Date().toISOString(),
} = {}) {
  let active = true;
  let currentSave = save;
  let error = "";

  root.classList?.add("is-onboarding");

  const persist = (nextSave, step, skipped = false) => {
    const persisted = onSave(nextSave);
    currentSave = persisted && typeof persisted === "object" ? persisted : nextSave;
    error = "";
    onFeedback({
      step,
      skipped,
      message: skipped ? "" : STEP_FEEDBACK[step] || "",
      save: currentSave,
    });
    render();
  };

  const answer = (step, value) => {
    try {
      persist(
        recordOnboardingAnswer(currentSave, step, value, nowFactory()),
        step,
      );
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "这条记录暂时无法写入";
      render();
    }
  };

  const skip = (step) => {
    try {
      persist(skipOnboardingStep(currentSave, step, nowFactory()), step, true);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : "暂时无法跳过这一步";
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
    if (!active) {
      return;
    }

    root.innerHTML = getPlayerOnboardingMarkup(currentSave, { error });

    bindClick("[data-action='exit']", () => {
      cleanup();
      onExit();
    });

    bindClick("[data-action='skip']", (event) => {
      skip(event.currentTarget.dataset.step);
    });

    bindClick("[data-answer-step='life_stage']", (event) => {
      answer("life_stage", event.currentTarget.dataset.value);
    });

    bindClick("[data-action='confirm-zodiac']", () => {
      answer("zodiac_confirm", true);
    });

    bindClick("[data-action='mbti-undetermined']", () => {
      answer("mbti", "undetermined");
    });

    bindForm("[data-form='player_name']", (form) => {
      answer("player_name", form.elements.namedItem("playerName")?.value);
    });

    bindForm("[data-form='custom-life-stage']", (form) => {
      answer("life_stage", {
        value: "custom",
        label: form.elements.namedItem("customLifeStage")?.value,
      });
    });

    bindForm("[data-form='birthday']", (form) => {
      answer("birthday", form.elements.namedItem("birthday")?.value);
    });

    bindForm("[data-form='zodiac']", (form) => {
      answer("zodiac_confirm", form.elements.namedItem("zodiac")?.value);
    });

    bindForm("[data-form='mbti']", (form) => {
      answer("mbti", form.elements.namedItem("mbti")?.value);
    });

    bindForm("[data-form='main_quest']", (form) => {
      answer("main_quest", form.elements.namedItem("mainQuest")?.value);
    });

    bindClick("[data-action='complete']", () => {
      try {
        const completedSave = finalizePlayerOnboarding(currentSave, nowFactory());
        const persisted = onSave(completedSave);
        currentSave = persisted && typeof persisted === "object" ? persisted : completedSave;
        active = false;
        root.classList?.remove("is-onboarding");
        onComplete(currentSave);
      } catch (caught) {
        error = caught instanceof Error ? caught.message : "玩家存档暂时无法建立";
        render();
      }
    });
  }

  function cleanup() {
    if (!active) {
      return;
    }
    active = false;
    root.classList?.remove("is-onboarding");
  }

  render();
  return cleanup;
}

function renderStep(step, onboarding, save) {
  const nickname = escapeHtml(onboarding.draft.nickname || "");

  if (step === "player_name") {
    return `
      <h2 data-onboarding-question>这份存档应如何称呼你？</h2>
      <form class="onboarding-entry" data-form="player_name">
        <label for="onboarding-player-name">玩家名称</label>
        <input id="onboarding-player-name" name="playerName" maxlength="40" autocomplete="nickname" autofocus />
        <button type="submit">确认名称</button>
      </form>
    `;
  }

  if (step === "life_stage") {
    return `
      <h2 data-onboarding-question>${nickname}，当前处于什么运行阶段？</h2>
      <div class="onboarding-options">
        ${LIFE_STAGE_OPTIONS.map((option) => `
          <button type="button" data-answer-step="life_stage" data-value="${option.value}">${option.label}</button>
        `).join("")}
      </div>
      <form class="onboarding-entry onboarding-entry-quiet" data-form="custom-life-stage">
        <label for="onboarding-life-stage">自行描述</label>
        <input id="onboarding-life-stage" name="customLifeStage" maxlength="32" />
        <button type="submit">写入</button>
      </form>
      ${renderSkip("life_stage")}
    `;
  }

  if (step === "birthday") {
    return `
      <h2 data-onboarding-question>是否记录生日周期？</h2>
      <p class="onboarding-context">可输入 YYYY-MM-DD，也可只输入 MM-DD。</p>
      <form class="onboarding-entry" data-form="birthday">
        <label for="onboarding-birthday">生日</label>
        <input id="onboarding-birthday" name="birthday" inputmode="numeric" placeholder="MM-DD" />
        <button type="submit">写入周期</button>
      </form>
      ${renderSkip("birthday")}
    `;
  }

  if (step === "zodiac_confirm") {
    const zodiac = onboarding.draft.zodiac?.value;
    return `
      <h2 data-onboarding-question>根据生日记录，星座识别为：${escapeHtml(getZodiacLabel(zodiac))}</h2>
      <div class="onboarding-options">
        <button type="button" data-action="confirm-zodiac">确认</button>
      </div>
      <form class="onboarding-entry onboarding-entry-quiet" data-form="zodiac">
        <label for="onboarding-zodiac">手动修改</label>
        <select id="onboarding-zodiac" name="zodiac">
          ${ZODIAC_OPTIONS.map((option) => `
            <option value="${option.value}" ${option.value === zodiac ? "selected" : ""}>${option.label}</option>
          `).join("")}
        </select>
        <button type="submit">改为此项</button>
      </form>
      ${renderSkip("zodiac_confirm", "不记录")}
    `;
  }

  if (step === "mbti") {
    return `
      <h2 data-onboarding-question>是否记录 MBTI？</h2>
      <p class="onboarding-context">该身份标签只会由你自行提交。</p>
      <form class="onboarding-entry" data-form="mbti">
        <label for="onboarding-mbti">MBTI</label>
        <input id="onboarding-mbti" name="mbti" maxlength="4" autocomplete="off" placeholder="INTP" />
        <button type="submit">写入标签</button>
      </form>
      <div class="onboarding-options onboarding-options-secondary">
        <button type="button" data-action="mbti-undetermined">尚未确定</button>
      </div>
      ${renderSkip("mbti", "不记录")}
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

  const summary = getOnboardingSummary({ ...save, onboarding });
  return `
    <h2 data-onboarding-question>基础玩家存档已准备完成。</h2>
    <div class="onboarding-summary" aria-label="建档摘要">
      <p>已恢复身份信息：${summary.identityCount}</p>
      <p>当前主线：${summary.questCount}</p>
      <p>历史记录：${summary.historyCount}</p>
    </div>
    <button class="onboarding-complete" type="button" data-action="complete">建立玩家存档</button>
  `;
}

function renderSkip(step, label = "暂不记录") {
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
