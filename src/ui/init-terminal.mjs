import { RUNTIME_STATUSES } from "../core/constants.mjs";
import { createInitialProfileSave } from "../core/profile.mjs";

const DEFAULT_NICKNAME = "未命名玩家";

const GENDER_OPTIONS = [
  ["male", "男"],
  ["female", "女"],
  ["non_binary", "非二元"],
  ["custom", "自定义"],
  ["prefer_not_to_say", "不透露"],
];

const STATUS_OPTIONS = [
  [RUNTIME_STATUSES.STABLE, "稳定运行"],
  [RUNTIME_STATUSES.HIGH_LOAD, "高负载"],
  [RUNTIME_STATUSES.LOW_ENERGY, "低能量"],
  [RUNTIME_STATUSES.LOST_ROUTE, "迷航"],
  [RUNTIME_STATUSES.MAINTENANCE, "维护中"],
  [RUNTIME_STATUSES.MAIN_QUEST_PUSH, "主线推进"],
];

const STEPS = [
  {
    code: "STEP 01",
    title: "玩家档案",
    note: "写入基础识别信息和运行标签。",
  },
  {
    code: "STEP 02",
    title: "旧存档导入",
    note: "把现实侧积累折算为初始等级和记录。",
  },
  {
    code: "STEP 03",
    title: "状态校准",
    note: "选择当前运行状态，生成第一份本地存档。",
  },
];

export function renderInitTerminal(root, { onComplete, onExit }) {
  const state = {
    step: 0,
    data: {
      profile: {
        nickname: DEFAULT_NICKNAME,
        gender: createGender("prefer_not_to_say"),
        selectedTags: ["观察者"],
        customTags: [],
      },
      importAnswers: {
        ageBand: "young_adult",
        educationStage: "undergraduate",
        currentStage: "working",
        stableSkillCount: 1,
        projectCount: 0,
        mainQuest: "",
        persistenceRecord: "months",
        setbackRecovery: "recovered",
        lifeMethod: "emerging",
        socialEnergy: "medium",
        runtimeStatus: RUNTIME_STATUSES.STABLE,
      },
    },
  };

  function commitCurrentStep() {
    readStep(root, state.step, state.data);
  }

  function render() {
    const step = STEPS[state.step];
    root.innerHTML = `
      <section class="terminal-shell" aria-label="首次运行初始化终端">
        <button class="terminal-exit" type="button" aria-label="退出初始化">×</button>
        <header class="terminal-header">
          <span>${step.code}</span>
          <h2>${step.title}</h2>
          <p>${step.note}</p>
        </header>
        <div class="terminal-progress" aria-label="初始化进度">
          ${STEPS.map((item, index) => `
            <span class="${index === state.step ? "is-active" : ""}">${item.code}</span>
          `).join("")}
        </div>
        <form class="terminal-form">${renderStep(state.step, state.data)}</form>
        <footer class="terminal-footer">
          <button type="button" data-action="back" ${state.step === 0 ? "disabled" : ""}>上一步</button>
          <button type="button" data-action="next">
            ${state.step === STEPS.length - 1 ? "写入存档" : "下一步"}
          </button>
        </footer>
      </section>
    `;

    root.querySelector(".terminal-exit").addEventListener("click", onExit);
    root.querySelector("[data-action='back']").addEventListener("click", () => {
      commitCurrentStep();
      state.step = Math.max(0, state.step - 1);
      render();
    });
    root.querySelector("[data-action='next']").addEventListener("click", () => {
      commitCurrentStep();

      if (state.step < STEPS.length - 1) {
        state.step += 1;
        render();
        return;
      }

      onComplete(createInitialProfileSave(normalizeData(state.data)));
    });
  }

  render();
}

function renderStep(step, data) {
  if (step === 0) {
    return renderProfileStep(data.profile);
  }

  if (step === 1) {
    return renderImportStep(data.importAnswers);
  }

  return renderCalibrationStep(data.importAnswers);
}

function renderProfileStep(profile) {
  return `
    <label>
      昵称
      <input name="nickname" autocomplete="nickname" value="${escapeHtml(profile.nickname)}" />
    </label>
    <label>
      性别
      <select name="gender">
        ${renderOptions(GENDER_OPTIONS, profile.gender?.type || "prefer_not_to_say")}
      </select>
    </label>
    <label class="terminal-wide">
      性格 / 运行标签
      <input name="tags" value="${escapeHtml(profile.selectedTags.join("，"))}" />
    </label>
    <label class="terminal-wide">
      自定义标签
      <input name="customTags" value="${escapeHtml(profile.customTags.join("，"))}" />
    </label>
  `;
}

function renderImportStep(answers) {
  return `
    <label>
      年龄段
      <select name="ageBand">
        ${renderOptions([
          ["teen", "青少年"],
          ["young_adult", "青年"],
          ["adult", "成年"],
          ["mature", "成熟期"],
        ], answers.ageBand)}
      </select>
    </label>
    <label>
      教育阶段
      <select name="educationStage">
        ${renderOptions([
          ["none", "未选择"],
          ["high_school", "高中 / 同等"],
          ["vocational", "职业教育"],
          ["undergraduate", "本科 / 同等"],
          ["graduate", "研究生及以上"],
        ], answers.educationStage)}
      </select>
    </label>
    <label>
      当前阶段
      <select name="currentStage">
        ${renderOptions([
          ["studying", "学习中"],
          ["working", "工作中"],
          ["freelancing", "自由职业"],
          ["exploring", "探索期"],
          ["caregiving", "照护 / 家庭职责"],
        ], answers.currentStage)}
      </select>
    </label>
    <label>
      稳定技能数量
      <input name="stableSkillCount" type="number" min="0" max="8" step="1" value="${escapeHtml(answers.stableSkillCount)}" />
    </label>
    <label>
      项目数量
      <input name="projectCount" type="number" min="0" max="12" step="1" value="${escapeHtml(answers.projectCount)}" />
    </label>
    <label>
      当前主线任务
      <input name="mainQuest" value="${escapeHtml(answers.mainQuest)}" />
    </label>
  `;
}

function renderCalibrationStep(answers) {
  return `
    <label>
      持续记录
      <select name="persistenceRecord">
        ${renderOptions([
          ["none", "暂无记录"],
          ["weeks", "数周"],
          ["months", "数月"],
          ["years", "数年"],
        ], answers.persistenceRecord)}
      </select>
    </label>
    <label>
      挫折恢复
      <select name="setbackRecovery">
        ${renderOptions([
          ["none", "暂无"],
          ["recovering", "恢复中"],
          ["recovered", "已恢复"],
          ["repeated_recovery", "多次恢复"],
        ], answers.setbackRecovery)}
      </select>
    </label>
    <label>
      人生方法论
      <select name="lifeMethod">
        ${renderOptions([
          ["unclear", "尚不清晰"],
          ["emerging", "正在形成"],
          ["clear_method", "较清晰"],
          ["reusable_system", "可复用系统"],
        ], answers.lifeMethod)}
      </select>
    </label>
    <label>
      社交能量
      <select name="socialEnergy">
        ${renderOptions([
          ["unknown", "未知"],
          ["high", "较高"],
          ["medium", "中等"],
          ["low", "低耗能"],
          ["depleted", "电量偏低"],
        ], answers.socialEnergy)}
      </select>
    </label>
    <label class="terminal-wide">
      运行状态
      <select name="runtimeStatus">
        ${renderOptions(STATUS_OPTIONS, answers.runtimeStatus)}
      </select>
    </label>
  `;
}

function readStep(root, step, data) {
  const form = root.querySelector(".terminal-form");
  const formData = new FormData(form);

  if (step === 0) {
    const nickname = String(formData.get("nickname") || "").trim();
    data.profile.nickname = nickname || DEFAULT_NICKNAME;
    data.profile.gender = createGender(String(formData.get("gender") || "prefer_not_to_say"));
    data.profile.selectedTags = splitTags(formData.get("tags"));
    data.profile.customTags = splitTags(formData.get("customTags"));
  }

  if (step === 1) {
    data.importAnswers.ageBand = String(formData.get("ageBand") || "young_adult");
    data.importAnswers.educationStage = String(formData.get("educationStage") || "undergraduate");
    data.importAnswers.currentStage = String(formData.get("currentStage") || "working");
    data.importAnswers.stableSkillCount = toCount(formData.get("stableSkillCount"));
    data.importAnswers.projectCount = toCount(formData.get("projectCount"));
    data.importAnswers.mainQuest = String(formData.get("mainQuest") || "").trim();
  }

  if (step === 2) {
    data.importAnswers.persistenceRecord = String(formData.get("persistenceRecord") || "months");
    data.importAnswers.setbackRecovery = String(formData.get("setbackRecovery") || "recovered");
    data.importAnswers.lifeMethod = String(formData.get("lifeMethod") || "emerging");
    data.importAnswers.socialEnergy = String(formData.get("socialEnergy") || "medium");
    data.importAnswers.runtimeStatus = String(formData.get("runtimeStatus") || RUNTIME_STATUSES.STABLE);
  }
}

function normalizeData(data) {
  return {
    profile: {
      ...data.profile,
      nickname: data.profile.nickname || DEFAULT_NICKNAME,
      selectedTags: data.profile.selectedTags,
      customTags: data.profile.customTags,
    },
    importAnswers: { ...data.importAnswers },
  };
}

function renderOptions(options, currentValue) {
  return options.map(([value, label]) => {
    const selected = value === currentValue ? " selected" : "";
    return `<option value="${escapeHtml(value)}"${selected}>${escapeHtml(label)}</option>`;
  }).join("");
}

function splitTags(value) {
  return String(value || "")
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function createGender(type) {
  const match = GENDER_OPTIONS.find(([value]) => value === type) || GENDER_OPTIONS.at(-1);
  return { type: match[0], label: match[1] };
}

function toCount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return 0;
  }

  return Math.max(0, Math.floor(number));
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
