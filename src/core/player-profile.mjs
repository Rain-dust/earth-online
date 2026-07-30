import { createMainQuest } from "./main-quest.mjs";
import {
  confirmPlayerLocation,
  normalizePlayerLocation,
} from "./player-location.mjs";

export const ONBOARDING_VERSION = 2;

export const ONBOARDING_STEPS = Object.freeze([
  "player_name",
  "location",
  "main_quest",
  "complete",
]);

const REMOVED_ONBOARDING_STEPS = Object.freeze([
  "life_stage",
  "birthday",
  "zodiac_confirm",
  "mbti",
  "summary",
]);

export const LIFE_STAGE_OPTIONS = Object.freeze([
  { value: "student", label: "在校" },
  { value: "working", label: "工作" },
  { value: "free_running", label: "自由运行" },
  { value: "paused", label: "暂时停靠" },
]);

export const ZODIAC_OPTIONS = Object.freeze([
  { value: "aries", label: "白羊座" },
  { value: "taurus", label: "金牛座" },
  { value: "gemini", label: "双子座" },
  { value: "cancer", label: "巨蟹座" },
  { value: "leo", label: "狮子座" },
  { value: "virgo", label: "处女座" },
  { value: "libra", label: "天秤座" },
  { value: "scorpio", label: "天蝎座" },
  { value: "sagittarius", label: "射手座" },
  { value: "capricorn", label: "摩羯座" },
  { value: "aquarius", label: "水瓶座" },
  { value: "pisces", label: "双鱼座" },
]);

const ANSWERABLE_STEPS = ONBOARDING_STEPS.filter((step) => step !== "complete");
const LEGACY_ANSWERABLE_STEPS = REMOVED_ONBOARDING_STEPS.filter((step) => step !== "summary");
const PERSISTED_STEPS = [...ANSWERABLE_STEPS, ...LEGACY_ANSWERABLE_STEPS];
const OPTIONAL_STEPS = new Set(["main_quest"]);
const LIFE_STAGE_VALUES = new Set(LIFE_STAGE_OPTIONS.map((option) => option.value));
const ZODIAC_VALUES = new Set(ZODIAC_OPTIONS.map((option) => option.value));

export function createEmptyOnboarding({ completed = false } = {}) {
  return {
    version: ONBOARDING_VERSION,
    status: completed ? "complete" : "not_started",
    completedSteps: [],
    skippedSteps: [],
    lastStep: completed ? "complete" : "player_name",
    draft: {},
  };
}

export function normalizeOnboarding(value, { hasProfile = false } = {}) {
  if (!isRecord(value)) {
    return createEmptyOnboarding({ completed: hasProfile });
  }

  const draft = normalizeDraft(value.draft);
  const completedSteps = normalizeSteps(value.completedSteps, PERSISTED_STEPS);
  const skippedSteps = normalizeSteps(value.skippedSteps, PERSISTED_STEPS)
    .filter((step) => !completedSteps.includes(step));
  const explicitlyComplete = value.status === "complete" || value.completed === true;
  const status = hasProfile || explicitlyComplete
    ? "complete"
    : resolveIncompleteStatus(value.status, completedSteps, skippedSteps);
  const requestedStep = [...ONBOARDING_STEPS, ...REMOVED_ONBOARDING_STEPS].includes(value.lastStep)
    ? value.lastStep
    : null;
  const firstPendingStep = getFirstPendingStep(completedSteps, skippedSteps, draft);
  const lastStep = status === "complete"
    ? "complete"
    : requestedStep
      && ONBOARDING_STEPS.includes(requestedStep)
      && requestedStep !== "complete"
      && requestedStep === firstPendingStep
      ? requestedStep
      : firstPendingStep;

  return {
    version: ONBOARDING_VERSION,
    status,
    completedSteps,
    skippedSteps,
    lastStep,
    draft,
  };
}

export function parseBirthday(value) {
  const input = String(value || "").trim();
  let year = null;
  let month;
  let day;

  const fullMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  const partialMatch = /^(\d{2})-(\d{2})$/.exec(input);

  if (fullMatch) {
    year = Number(fullMatch[1]);
    month = Number(fullMatch[2]);
    day = Number(fullMatch[3]);
  } else if (partialMatch) {
    month = Number(partialMatch[1]);
    day = Number(partialMatch[2]);
  } else {
    return null;
  }

  if (!isValidCalendarDate(year, month, day)) {
    return null;
  }

  return {
    year,
    month,
    day,
    yearIsPrivate: year === null,
  };
}

export function deriveZodiac(month, day) {
  if (!isValidCalendarDate(null, Number(month), Number(day))) {
    return null;
  }

  const dateCode = Number(month) * 100 + Number(day);

  if (dateCode >= 1222 || dateCode <= 119) return "capricorn";
  if (dateCode <= 218) return "aquarius";
  if (dateCode <= 320) return "pisces";
  if (dateCode <= 419) return "aries";
  if (dateCode <= 520) return "taurus";
  if (dateCode <= 621) return "gemini";
  if (dateCode <= 722) return "cancer";
  if (dateCode <= 822) return "leo";
  if (dateCode <= 922) return "virgo";
  if (dateCode <= 1023) return "libra";
  if (dateCode <= 1122) return "scorpio";
  return "sagittarius";
}

export function getZodiacLabel(value) {
  return ZODIAC_OPTIONS.find((option) => option.value === value)?.label || "";
}

export function normalizeMbti(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return /^[EI][NS][TF][JP]$/.test(normalized) ? normalized : null;
}

export function recordOnboardingAnswer(
  save,
  step,
  value,
  now = new Date().toISOString(),
) {
  const onboarding = getActiveOnboarding(save, step);
  const draft = { ...onboarding.draft };

  if (step === "player_name") {
    const nickname = String(value || "").trim();
    if (!nickname) {
      throw new Error("玩家名称不能为空");
    }
    if (nickname.length > 16) {
      throw new Error("玩家名称不能超过 16 个字符");
    }
    draft.nickname = nickname;
  } else if (step === "location") {
    Object.assign(draft, confirmPlayerLocation(draft, value, now));
  } else if (step === "main_quest") {
    const title = String(value || "").trim();
    if (!title) {
      throw new Error("主线名称不能为空");
    }
    draft.mainQuest = title;
  } else {
    throw new Error("当前步骤不能写入答案");
  }

  return {
    ...save,
    onboarding: {
      ...onboarding,
      status: "in_progress",
      completedSteps: appendUnique(onboarding.completedSteps, step),
      skippedSteps: onboarding.skippedSteps.filter((item) => item !== step),
      lastStep: getNextStep(step),
      draft,
    },
  };
}

export function skipOnboardingStep(save, step) {
  if (!OPTIONAL_STEPS.has(step)) {
    throw new Error("当前建档信息不能跳过");
  }

  const onboarding = getActiveOnboarding(save, step);
  const draft = { ...onboarding.draft };
  delete draft.mainQuest;

  return {
    ...save,
    onboarding: {
      ...onboarding,
      status: "in_progress",
      completedSteps: onboarding.completedSteps.filter((item) => item !== step),
      skippedSteps: appendUnique(onboarding.skippedSteps, step),
      lastStep: getNextStep(step),
      draft,
    },
  };
}

export function finalizePlayerOnboarding(
  save,
  now = new Date().toISOString(),
  { idFactory } = {},
) {
  const onboarding = normalizeOnboarding(save?.onboarding, { hasProfile: Boolean(save?.profile) });

  if (save?.profile && onboarding.status === "complete") {
    return save;
  }
  if (onboarding.lastStep !== "complete") {
    throw new Error("建档尚未完成必要信息");
  }

  const nickname = String(onboarding.draft.nickname || "").trim();
  if (!nickname) {
    throw new Error("玩家名称不能为空");
  }

  const profile = {
    nickname,
    createdAt: save?.profile?.createdAt || now,
  };

  const playerLocation = normalizePlayerLocation(onboarding.draft);
  if (playerLocation.locationSetupStatus !== "confirmed" || !playerLocation.location) {
    throw new Error("请选择城市并确认位置锚点");
  }
  profile.locationSetupStatus = playerLocation.locationSetupStatus;
  profile.location = playerLocation.location;

  for (const field of ["lifeStage", "birthday", "zodiac", "mbti"]) {
    if (onboarding.draft[field]) {
      profile[field] = { ...onboarding.draft[field] };
    }
  }

  let completedSave = {
    ...save,
    profile,
    onboarding: {
      ...onboarding,
      status: "complete",
      lastStep: "complete",
      draft: {},
    },
  };

  if (onboarding.draft.mainQuest && !completedSave.mainQuest) {
    completedSave = createMainQuest(completedSave, {
      title: onboarding.draft.mainQuest,
      firstAction: onboarding.draft.mainQuest,
    }, now, { idFactory });
  }

  return completedSave;
}

function getActiveOnboarding(save, step) {
  if (!ANSWERABLE_STEPS.includes(step)) {
    throw new Error("未知的建档步骤");
  }

  const onboarding = normalizeOnboarding(save?.onboarding, { hasProfile: Boolean(save?.profile) });
  if (onboarding.status === "complete") {
    throw new Error("玩家档案已经建立");
  }
  if (onboarding.lastStep !== step) {
    throw new Error("当前建档步骤已变化");
  }

  return onboarding;
}

function normalizeDraft(value) {
  if (!isRecord(value)) {
    return {};
  }

  const draft = {};
  const nickname = String(value.nickname || "").trim();
  if (nickname) draft.nickname = nickname;

  if (isRecord(value.lifeStage)) {
    const lifeStageValue = String(value.lifeStage.value || "");
    const validStandard = LIFE_STAGE_VALUES.has(lifeStageValue);
    const validCustom = lifeStageValue === "custom" && String(value.lifeStage.label || "").trim();
    if (validStandard || validCustom) draft.lifeStage = { ...value.lifeStage };
  }

  const playerLocation = normalizePlayerLocation(value);
  if (playerLocation.locationSetupStatus !== "unseen") {
    draft.locationSetupStatus = playerLocation.locationSetupStatus;
    if (playerLocation.location) draft.location = playerLocation.location;
  }

  if (isRecord(value.birthday)) {
    const birthdayInput = value.birthday.year == null
      ? `${pad(value.birthday.month)}-${pad(value.birthday.day)}`
      : `${value.birthday.year}-${pad(value.birthday.month)}-${pad(value.birthday.day)}`;
    const birthday = parseBirthday(birthdayInput);
    if (birthday) draft.birthday = { ...birthday, source: "user" };
  }

  if (isRecord(value.zodiac) && ZODIAC_VALUES.has(value.zodiac.value)) {
    draft.zodiac = {
      value: value.zodiac.value,
      source: value.zodiac.source === "user" ? "user" : "derived_from_birthday",
      confirmedByUser: value.zodiac.confirmedByUser === true,
    };
  }

  if (isRecord(value.mbti)) {
    const mbti = normalizeMbti(value.mbti.value);
    if (mbti) {
      draft.mbti = { value: mbti, source: "user", confidence: "self_reported" };
    } else if (value.mbti.confidence === "undetermined") {
      draft.mbti = { value: null, source: "user", confidence: "undetermined" };
    }
  }

  const mainQuest = String(value.mainQuest || "").trim();
  if (mainQuest) draft.mainQuest = mainQuest;

  return draft;
}

function resolveIncompleteStatus(status, completedSteps, skippedSteps) {
  if (status === "in_progress") return "in_progress";
  if (status === "not_started" && completedSteps.length === 0 && skippedSteps.length === 0) {
    return "not_started";
  }
  return completedSteps.length > 0 || skippedSteps.length > 0
    ? "in_progress"
    : "not_started";
}

function getFirstPendingStep(completedSteps, skippedSteps, draft) {
  if (!draft.nickname) return "player_name";
  if (normalizePlayerLocation(draft).locationSetupStatus !== "confirmed") return "location";
  const handled = new Set([...completedSteps, ...skippedSteps]);
  return draft.mainQuest || handled.has("main_quest") ? "complete" : "main_quest";
}

function getNextStep(step) {
  const index = ONBOARDING_STEPS.indexOf(step);
  return ONBOARDING_STEPS[index + 1] || "complete";
}

function normalizeSteps(value, allowed) {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowedSet = new Set(allowed);
  return [...new Set(value.filter((step) => allowedSet.has(step)))];
}

function appendUnique(values, value) {
  return values.includes(value) ? values : [...values, value];
}

function isValidCalendarDate(year, month, day) {
  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    return false;
  }

  const validationYear = year === null ? 2000 : Number(year);
  if (!Number.isInteger(validationYear) || validationYear < 1 || validationYear > 9999) {
    return false;
  }

  const date = new Date(Date.UTC(validationYear, month - 1, day));
  return date.getUTCFullYear() === validationYear
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function pad(value) {
  return String(value ?? "").padStart(2, "0");
}
