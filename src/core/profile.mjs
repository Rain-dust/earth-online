import { RUNTIME_STATUSES } from "./constants.mjs";
import { getLevelFromExp, getRarity } from "./progression.mjs";
import { createEmptySave } from "./storage.mjs";

const SCORE_TABLES = {
  ageBand: { infant: 0, teen: 700, young_adult: 1300, adult: 2200, mature: 3100 },
  educationStage: { none: 0, high_school: 450, vocational: 650, undergraduate: 1100, graduate: 1600 },
  currentStage: { studying: 600, working: 1200, freelancing: 1200, exploring: 800, caregiving: 1100 },
  persistenceRecord: { none: 0, weeks: 350, months: 1400, years: 2400 },
  setbackRecovery: { none: 0, recovering: 550, recovered: 1300, repeated_recovery: 2100 },
  lifeMethod: { unclear: 0, emerging: 600, clear_method: 1200, reusable_system: 2000 },
  socialEnergy: { unknown: 0, high: 280, medium: 360, low: 420, depleted: 300 },
};

export function createInitialProfileSave({
  now = new Date().toISOString(),
  profile = {},
  importAnswers = {},
} = {}) {
  const save = createEmptySave(now);
  const exp = calculateInitialExp(importAnswers);
  const level = getLevelFromExp(exp);
  const status = importAnswers.runtimeStatus || RUNTIME_STATUSES.STABLE;
  const tags = unique([
    ...(profile.selectedTags || []),
    ...(profile.customTags || []),
    inferRuntimeTag(importAnswers.socialEnergy),
  ]);
  const achievements = createInitialAchievements(importAnswers, now);
  const titles = unique(["旧存档持有者", inferInitialTitle(level.value, status)]);

  return {
    ...save,
    profile: {
      nickname: String(profile.nickname || "未命名玩家").trim(),
      gender: profile.gender || null,
      createdAt: now,
    },
    level,
    currentStatus: status,
    statusHistory: [
      {
        status,
        at: now,
        source: "initial_calibration",
      },
    ],
    mainQuest: normalizeMainQuest(importAnswers.mainQuest, now),
    achievements,
    titles,
    tags,
    realLifeAchievements: achievements.filter((item) => item.source === "self_confirmed"),
    settings: {
      ...save.settings,
      selectedTitle: titles[0],
      fixedTags: tags.slice(0, 2),
    },
  };
}

export function calculateInitialExp(answers = {}) {
  return [
    SCORE_TABLES.ageBand[answers.ageBand] || 0,
    SCORE_TABLES.educationStage[answers.educationStage] || 0,
    SCORE_TABLES.currentStage[answers.currentStage] || 0,
    SCORE_TABLES.persistenceRecord[answers.persistenceRecord] || 0,
    SCORE_TABLES.setbackRecovery[answers.setbackRecovery] || 0,
    SCORE_TABLES.lifeMethod[answers.lifeMethod] || 0,
    SCORE_TABLES.socialEnergy[answers.socialEnergy] || 0,
    Math.min(Number(answers.stableSkillCount) || 0, 8) * 120,
    Math.min(Number(answers.projectCount) || 0, 12) * 150,
    answers.resourceStatus && answers.resourceStatus !== "skip" ? 240 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function createInitialAchievements(answers, now) {
  const achievements = [
    createAchievement("old_save_imported", "旧存档导入完成", "self_confirmed", now),
  ];

  if ((Number(answers.stableSkillCount) || 0) > 0) {
    achievements.push(createAchievement("stable_skill_confirmed", "稳定技能已记录", "self_confirmed", now));
  }

  if ((Number(answers.projectCount) || 0) > 0) {
    achievements.push(createAchievement("project_record_confirmed", "项目记录已确认", "self_confirmed", now));
  }

  if (answers.setbackRecovery === "recovered" || answers.setbackRecovery === "repeated_recovery") {
    achievements.push(createAchievement("setback_recovered", "异常恢复记录", "self_confirmed", now));
  }

  if (answers.lifeMethod === "clear_method" || answers.lifeMethod === "reusable_system") {
    achievements.push(createAchievement("life_method_found", "运行方法已形成", "self_confirmed", now));
  }

  return achievements;
}

function createAchievement(id, label, source, now) {
  return {
    id,
    label,
    rarity: getRarity(id),
    rarityLabel: "全服",
    source,
    unlockedAt: now,
  };
}

function normalizeMainQuest(mainQuest, now) {
  const title = String(mainQuest || "").trim();

  if (!title) {
    return null;
  }

  return {
    title,
    createdAt: now,
    status: "active",
  };
}

function inferInitialTitle(level, status) {
  if (status === RUNTIME_STATUSES.HIGH_LOAD) {
    return level >= 25 ? "高负载运行体" : "负载观察员";
  }

  if (level >= 30) {
    return "现实侧适应者";
  }

  if (level >= 16) {
    return "长期运行者";
  }

  return "新手存档校准中";
}

function inferRuntimeTag(socialEnergy) {
  if (socialEnergy === "low" || socialEnergy === "depleted") {
    return "低耗能";
  }

  return "观察者";
}

function unique(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}
