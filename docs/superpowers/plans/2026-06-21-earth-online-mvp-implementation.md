# Earth Online MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Earth Online closed-loop MVP: cinematic Earth home, dynamic global player count, first-run profile import, task-first orbital terminal panel, EXP/level/achievement system, and readable local save import/export.

**Architecture:** Keep the app static and local-first. Split pure system logic into small `.mjs` modules with Node tests, then connect those modules to a Three.js/three-globe scene and vanilla DOM UI. Keep visual effects anchored to open-source `three-globe`/`globe.gl` examples and public Earth texture references.

**Tech Stack:** Vanilla HTML/CSS/JavaScript modules, Three.js, three-globe, browser `localStorage`, Node built-in test runner, local static server.

---

## Scope Check

This plan implements the approved MVP as one closed loop. It deliberately excludes coins, lottery, shop, inventory, accounts, cloud sync, backend database, and social systems.

## File Structure

Create or modify these files:

- `package.json`: local scripts for static server and Node tests.
- `index.html`: app shell and module entry point.
- `server.js`: local static server, kept CommonJS.
- `OPEN_SOURCE_REFERENCES.md`: references used by visuals and public data.
- `src/main.js`: thin app bootstrap only.
- `src/app/controller.mjs`: state machine and event orchestration.
- `src/app/dom.mjs`: DOM references and render helpers.
- `src/core/constants.mjs`: statuses, task categories, labels, achievement definitions.
- `src/core/population.mjs`: global player count estimator.
- `src/core/profile.mjs`: profile initialization scoring and initial save creation.
- `src/core/tasks.mjs`: daily task generation and task completion.
- `src/core/progression.mjs`: EXP, levels, achievement/title/tag unlocks.
- `src/core/storage.mjs`: localStorage persistence and JSON import/export validation.
- `src/scene/earth-scene.mjs`: Three.js/three-globe scene, home/focus/panel visual states.
- `src/ui/home.mjs`: home title and player-count readout.
- `src/ui/init-terminal.mjs`: 3-step first-run initialization terminal.
- `src/ui/system-panel.mjs`: task-first orbital terminal panel.
- `src/styles.css`: responsive visual system.
- `tests/core/population.test.mjs`: population estimator tests.
- `tests/core/profile.test.mjs`: initialization scoring tests.
- `tests/core/tasks.test.mjs`: task generation and completion tests.
- `tests/core/progression.test.mjs`: level and achievement tests.
- `tests/core/storage.test.mjs`: save/import/export tests.

## Open-source Reference Rules

- Use `three-globe` and `globe.gl` examples before writing custom globe effects.
- Use local copies of public Earth textures and document their source.
- Use generated imagery only for non-real UI atmosphere, panel texture, theme art, or badge-like assets.
- Record every adopted visual/data reference in `OPEN_SOURCE_REFERENCES.md`.

---

### Task 1: Add Test Harness And Preserve Local Server

**Files:**
- Create: `package.json`
- Modify: `server.js`

- [ ] **Step 1: Add package scripts**

Create `package.json`:

```json
{
  "name": "earth-online-local",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "start": "node server.js",
    "test": "node --test tests"
  }
}
```

- [ ] **Step 2: Run test command before tests exist**

Run: `npm test`

Expected: the command exits with a message that no test files are present or zero tests run. If Node reports that `tests` does not exist, create the `tests/core` directory in the next task before re-running.

- [ ] **Step 3: Confirm server still starts**

Run: `node server.js`

Expected: console prints `Earth Online listening on http://localhost:58804`.

Stop the server after confirming. If a previous server is already running on the port, keep that one and do not start a duplicate.

- [ ] **Step 4: Commit**

```bash
git add package.json server.js
git commit -m "chore: add local test scripts"
```

---

### Task 2: Define Core Constants And Save Schema

**Files:**
- Create: `src/core/constants.mjs`
- Create: `src/core/storage.mjs`
- Create: `tests/core/storage.test.mjs`

- [ ] **Step 1: Write storage schema tests**

Create `tests/core/storage.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptySave,
  exportSave,
  importSave,
  SAVE_FORMAT,
} from "../../src/core/storage.mjs";

test("createEmptySave returns versioned readable save shell", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.equal(save.format, SAVE_FORMAT);
  assert.equal(save.exportedAt, "2026-06-21T20:24:00+08:00");
  assert.equal(save.systemNote, "旧存档仍在运行");
  assert.deepEqual(save.profile, null);
  assert.deepEqual(save.dailyTasks, []);
  assert.deepEqual(save.correctionLog, []);
});

test("exportSave returns stable pretty JSON", () => {
  const save = createEmptySave("2026-06-21T20:24:00+08:00");
  const json = exportSave(save);

  assert.match(json, /"format": "earth-online-save-v1"/);
  assert.match(json, /"systemNote": "旧存档仍在运行"/);
  assert.equal(JSON.parse(json).format, SAVE_FORMAT);
});

test("importSave rejects unknown formats without mutating current save", () => {
  const current = createEmptySave("2026-06-21T20:24:00+08:00");

  assert.throws(
    () => importSave('{"format":"wrong"}', current),
    /Unsupported save format/,
  );
  assert.equal(current.format, SAVE_FORMAT);
});
```

- [ ] **Step 2: Run storage tests to verify failure**

Run: `npm test`

Expected: FAIL with module-not-found errors for `src/core/storage.mjs`.

- [ ] **Step 3: Create constants**

Create `src/core/constants.mjs`:

```js
export const RUNTIME_STATUSES = Object.freeze({
  STABLE: "stable_operation",
  HIGH_LOAD: "high_load",
  LOW_ENERGY: "low_energy",
  LOST_ROUTE: "lost_route",
  MAINTENANCE: "maintenance_mode",
  MAIN_QUEST_PUSH: "main_quest_push",
});

export const STATUS_LABELS = Object.freeze({
  [RUNTIME_STATUSES.STABLE]: "稳定运行",
  [RUNTIME_STATUSES.HIGH_LOAD]: "高负载",
  [RUNTIME_STATUSES.LOW_ENERGY]: "低能量",
  [RUNTIME_STATUSES.LOST_ROUTE]: "迷航",
  [RUNTIME_STATUSES.MAINTENANCE]: "维护中",
  [RUNTIME_STATUSES.MAIN_QUEST_PUSH]: "主线推进",
});

export const TASK_CATEGORIES = Object.freeze({
  MAIN_QUEST: "main_quest",
  BODY: "body_maintenance",
  INPUT: "cognitive_input",
  OUTPUT: "creative_output",
  ENVIRONMENT: "environment_cleanup",
  NPC: "npc_noise_reduction",
});

export const TASK_CATEGORY_LABELS = Object.freeze({
  [TASK_CATEGORIES.MAIN_QUEST]: "主线维护",
  [TASK_CATEGORIES.BODY]: "身体维护",
  [TASK_CATEGORIES.INPUT]: "认知输入",
  [TASK_CATEGORIES.OUTPUT]: "创作输出",
  [TASK_CATEGORIES.ENVIRONMENT]: "环境整理",
  [TASK_CATEGORIES.NPC]: "NPC 过滤",
});

export const DEFAULT_TAGS = Object.freeze([
  "INTP",
  "INFJ",
  "观察者",
  "夜行型",
  "低耗能",
  "长期主义",
  "创作者",
  "技术流",
  "NPC过滤器",
]);
```

- [ ] **Step 4: Create storage module**

Create `src/core/storage.mjs`:

```js
export const SAVE_FORMAT = "earth-online-save-v1";
export const STORAGE_KEY = "earth-online-save-v1";

export function createEmptySave(exportedAt = new Date().toISOString()) {
  return {
    format: SAVE_FORMAT,
    exportedAt,
    systemNote: "旧存档仍在运行",
    profile: null,
    level: { value: 1, exp: 0, nextLevelExp: 100 },
    currentStatus: null,
    statusHistory: [],
    dailyTasks: [],
    taskHistory: [],
    achievements: [],
    titles: [],
    tags: [],
    realLifeAchievements: [],
    correctionLog: [],
    customTaskPool: [],
    mainQuest: null,
    settings: {
      fixedTags: [],
      hiddenTags: [],
      selectedTitle: null,
    },
  };
}

export function exportSave(save) {
  return `${JSON.stringify(normalizeSaveForExport(save), null, 2)}\n`;
}

export function importSave(json, currentSave = createEmptySave()) {
  let parsed;

  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error("Save JSON is not valid");
  }

  if (parsed.format !== SAVE_FORMAT) {
    throw new Error("Unsupported save format");
  }

  return mergeWithDefaults(parsed, currentSave);
}

export function loadLocalSave(storage = globalThis.localStorage) {
  if (!storage) {
    return createEmptySave();
  }

  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    return createEmptySave();
  }

  return importSave(raw);
}

export function saveLocalSave(save, storage = globalThis.localStorage) {
  if (!storage) {
    return save;
  }

  storage.setItem(STORAGE_KEY, exportSave(save));
  return save;
}

function normalizeSaveForExport(save) {
  return mergeWithDefaults(save, createEmptySave(save.exportedAt));
}

function mergeWithDefaults(save, defaults) {
  return {
    ...defaults,
    ...save,
    level: { ...defaults.level, ...(save.level || {}) },
    settings: { ...defaults.settings, ...(save.settings || {}) },
    dailyTasks: Array.isArray(save.dailyTasks) ? save.dailyTasks : defaults.dailyTasks,
    taskHistory: Array.isArray(save.taskHistory) ? save.taskHistory : defaults.taskHistory,
    achievements: Array.isArray(save.achievements) ? save.achievements : defaults.achievements,
    titles: Array.isArray(save.titles) ? save.titles : defaults.titles,
    tags: Array.isArray(save.tags) ? save.tags : defaults.tags,
    correctionLog: Array.isArray(save.correctionLog) ? save.correctionLog : defaults.correctionLog,
    customTaskPool: Array.isArray(save.customTaskPool) ? save.customTaskPool : defaults.customTaskPool,
  };
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS for storage tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/constants.mjs src/core/storage.mjs tests/core/storage.test.mjs package.json
git commit -m "feat: add local save schema"
```

---

### Task 3: Add Global Player Count Estimator

**Files:**
- Create: `src/core/population.mjs`
- Create: `tests/core/population.test.mjs`
- Modify: `OPEN_SOURCE_REFERENCES.md`

- [ ] **Step 1: Write population tests**

Create `tests/core/population.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_POPULATION_BASELINE,
  estimatePopulation,
  formatPopulation,
} from "../../src/core/population.mjs";

test("estimatePopulation returns baseline at baseline timestamp", () => {
  const value = estimatePopulation({
    nowMs: WORLD_POPULATION_BASELINE.timestampMs,
    baseline: WORLD_POPULATION_BASELINE,
  });

  assert.equal(value, WORLD_POPULATION_BASELINE.value);
});

test("estimatePopulation increases after time passes", () => {
  const value = estimatePopulation({
    nowMs: WORLD_POPULATION_BASELINE.timestampMs + 86_400_000,
    baseline: WORLD_POPULATION_BASELINE,
  });

  assert.ok(value > WORLD_POPULATION_BASELINE.value);
});

test("formatPopulation uses grouped digits", () => {
  assert.equal(formatPopulation(8141808945), "8,141,808,945");
});
```

- [ ] **Step 2: Run population tests to verify failure**

Run: `npm test`

Expected: FAIL with module-not-found for `src/core/population.mjs`.

- [ ] **Step 3: Implement population estimator**

Create `src/core/population.mjs`:

```js
export const WORLD_POPULATION_BASELINE = Object.freeze({
  value: 8_141_808_945,
  timestampMs: Date.UTC(2024, 6, 1, 0, 0, 0),
  annualGrowthRate: 0.0086,
  source: "World Bank WLD SP.POP.TOTL 2024, accessed during design research",
});

export function estimatePopulation({
  nowMs = Date.now(),
  baseline = WORLD_POPULATION_BASELINE,
} = {}) {
  const elapsedYears = Math.max(0, nowMs - baseline.timestampMs) / (365.2425 * 24 * 60 * 60 * 1000);
  const estimated = baseline.value * Math.pow(1 + baseline.annualGrowthRate, elapsedYears);
  return Math.floor(estimated);
}

export function formatPopulation(value) {
  return new Intl.NumberFormat("en-US").format(value);
}
```

- [ ] **Step 4: Update references**

Append to `OPEN_SOURCE_REFERENCES.md`:

```md

## Population Baseline

- World Bank API, WLD `SP.POP.TOTL`, used as the first MVP population baseline. The UI presents this as an estimate, not exact live census data.
  https://api.worldbank.org/v2/country/WLD/indicator/SP.POP.TOTL?format=json
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS for storage and population tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/population.mjs tests/core/population.test.mjs OPEN_SOURCE_REFERENCES.md
git commit -m "feat: add global player count estimator"
```

---

### Task 4: Add Profile Import And Initial Progression Logic

**Files:**
- Create: `src/core/profile.mjs`
- Create: `src/core/progression.mjs`
- Create: `tests/core/profile.test.mjs`
- Create: `tests/core/progression.test.mjs`

- [ ] **Step 1: Write profile tests**

Create `tests/core/profile.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { RUNTIME_STATUSES } from "../../src/core/constants.mjs";
import { createInitialProfileSave } from "../../src/core/profile.mjs";

test("createInitialProfileSave builds old-save import result", () => {
  const save = createInitialProfileSave({
    now: "2026-06-21T20:24:00+08:00",
    profile: {
      nickname: "测试玩家",
      gender: { type: "prefer_not_to_say", label: "不透露" },
      selectedTags: ["观察者", "长期主义"],
      customTags: ["低耗能"],
    },
    importAnswers: {
      ageBand: "adult",
      educationStage: "undergraduate",
      currentStage: "working",
      stableSkillCount: 3,
      mainSkillArea: "technical",
      projectCount: 2,
      resourceStatus: "skip",
      mainQuest: "地球 Online",
      persistenceRecord: "months",
      setbackRecovery: "recovered",
      lifeMethod: "clear_method",
      socialEnergy: "low",
      runtimeStatus: RUNTIME_STATUSES.HIGH_LOAD,
    },
  });

  assert.equal(save.profile.nickname, "测试玩家");
  assert.equal(save.mainQuest.title, "地球 Online");
  assert.ok(save.level.value >= 16);
  assert.equal(save.currentStatus, RUNTIME_STATUSES.HIGH_LOAD);
  assert.ok(save.titles.includes("旧存档持有者"));
  assert.ok(save.tags.includes("观察者"));
  assert.ok(save.tags.includes("低耗能"));
  assert.ok(save.achievements.some((item) => item.id === "old_save_imported"));
});
```

- [ ] **Step 2: Write progression tests**

Create `tests/core/progression.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { applyExp, getLevelFromExp } from "../../src/core/progression.mjs";

test("getLevelFromExp uses slower growth at higher levels", () => {
  assert.equal(getLevelFromExp(0).value, 1);
  assert.ok(getLevelFromExp(1800).value > 10);
  assert.ok(getLevelFromExp(8000).value > getLevelFromExp(1800).value);
});

test("applyExp updates level progress", () => {
  const level = applyExp({ value: 1, exp: 0, nextLevelExp: 100 }, 140);

  assert.ok(level.exp >= 140);
  assert.ok(level.value >= 2);
  assert.ok(level.nextLevelExp > level.exp);
});
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npm test`

Expected: FAIL with module-not-found for `profile.mjs` and `progression.mjs`.

- [ ] **Step 4: Implement progression**

Create `src/core/progression.mjs`:

```js
export function getLevelFromExp(exp) {
  const safeExp = Math.max(0, Number(exp) || 0);
  const value = Math.max(1, Math.floor(Math.sqrt(safeExp / 36)) + 1);
  const nextLevelExp = getRequiredExpForLevel(value + 1);

  return {
    value,
    exp: safeExp,
    nextLevelExp,
    progress: Math.min(0.99, safeExp / nextLevelExp),
  };
}

export function getRequiredExpForLevel(level) {
  const safeLevel = Math.max(2, Number(level) || 2);
  return Math.round(Math.pow(safeLevel - 1, 2) * 36);
}

export function applyExp(currentLevel, gainedExp) {
  const nextExp = Math.max(0, (currentLevel?.exp || 0) + gainedExp);
  return getLevelFromExp(nextExp);
}

export function getRarity(seed, min = 3.2, max = 64.8) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  const ratio = hash / 0xffffffff;
  return Number((min + ratio * (max - min)).toFixed(1));
}
```

- [ ] **Step 5: Implement profile import**

Create `src/core/profile.mjs`:

```js
import { RUNTIME_STATUSES } from "./constants.mjs";
import { getLevelFromExp, getRarity } from "./progression.mjs";
import { createEmptySave } from "./storage.mjs";

const SCORE_TABLES = {
  ageBand: { infant: 0, teen: 180, young_adult: 540, adult: 900, mature: 1300 },
  educationStage: { none: 0, high_school: 180, vocational: 260, undergraduate: 420, graduate: 620 },
  currentStage: { studying: 180, working: 360, freelancing: 360, exploring: 220, caregiving: 340 },
  persistenceRecord: { none: 0, weeks: 120, months: 300, years: 620 },
  setbackRecovery: { none: 0, recovering: 160, recovered: 420, repeated_recovery: 700 },
  lifeMethod: { unclear: 0, emerging: 180, clear_method: 420, reusable_system: 680 },
  socialEnergy: { unknown: 0, high: 120, medium: 180, low: 220, depleted: 140 },
};

export function createInitialProfileSave({ now = new Date().toISOString(), profile, importAnswers }) {
  const save = createEmptySave(now);
  const exp = calculateInitialExp(importAnswers);
  const level = getLevelFromExp(exp);
  const baseTags = unique([
    ...(profile.selectedTags || []),
    ...(profile.customTags || []),
    inferRuntimeTag(importAnswers.socialEnergy),
  ]);
  const achievements = createInitialAchievements(importAnswers, now);
  const titles = unique(["旧存档持有者", inferInitialTitle(level.value, importAnswers.runtimeStatus)]);

  return {
    ...save,
    profile: {
      nickname: profile.nickname.trim(),
      gender: profile.gender,
      createdAt: now,
    },
    level,
    currentStatus: importAnswers.runtimeStatus || RUNTIME_STATUSES.STABLE,
    statusHistory: [
      {
        status: importAnswers.runtimeStatus || RUNTIME_STATUSES.STABLE,
        at: now,
        source: "initial_calibration",
      },
    ],
    mainQuest: importAnswers.mainQuest
      ? { title: importAnswers.mainQuest.trim(), createdAt: now, status: "active" }
      : null,
    achievements,
    titles,
    tags: baseTags,
    realLifeAchievements: achievements.filter((item) => item.source === "self_confirmed"),
    settings: {
      ...save.settings,
      selectedTitle: titles[0],
      fixedTags: baseTags.slice(0, 2),
    },
  };
}

export function calculateInitialExp(answers) {
  return [
    SCORE_TABLES.ageBand[answers.ageBand] || 0,
    SCORE_TABLES.educationStage[answers.educationStage] || 0,
    SCORE_TABLES.currentStage[answers.currentStage] || 0,
    SCORE_TABLES.persistenceRecord[answers.persistenceRecord] || 0,
    SCORE_TABLES.setbackRecovery[answers.setbackRecovery] || 0,
    SCORE_TABLES.lifeMethod[answers.lifeMethod] || 0,
    SCORE_TABLES.socialEnergy[answers.socialEnergy] || 0,
    Math.min(answers.stableSkillCount || 0, 8) * 90,
    Math.min(answers.projectCount || 0, 12) * 110,
    answers.resourceStatus && answers.resourceStatus !== "skip" ? 180 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function createInitialAchievements(answers, now) {
  const achievements = [
    createAchievement("old_save_imported", "旧存档导入完成", "全服", "self_confirmed", now),
  ];

  if ((answers.projectCount || 0) > 0) {
    achievements.push(createAchievement("project_trace_detected", "检测到项目痕迹", "全服", "self_confirmed", now));
  }

  if (answers.setbackRecovery === "recovered" || answers.setbackRecovery === "repeated_recovery") {
    achievements.push(createAchievement("recovered_runtime", "崩溃后仍在运行", "全服", "self_confirmed", now));
  }

  return achievements;
}

function createAchievement(id, label, rarityLabel, source, unlockedAt) {
  return {
    id,
    label,
    rarity: getRarity(id),
    rarityLabel,
    source,
    unlockedAt,
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
    return "稳定运行个体";
  }
  return "基础适应者";
}

function inferRuntimeTag(socialEnergy) {
  if (socialEnergy === "low" || socialEnergy === "depleted") {
    return "低耗能";
  }
  return "观察者";
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
```

- [ ] **Step 6: Run tests**

Run: `npm test`

Expected: PASS for storage, population, profile, and progression tests.

- [ ] **Step 7: Commit**

```bash
git add src/core/profile.mjs src/core/progression.mjs tests/core/profile.test.mjs tests/core/progression.test.mjs
git commit -m "feat: add old save import scoring"
```

---

### Task 5: Add Task Generation And Completion Logic

**Files:**
- Create: `src/core/tasks.mjs`
- Create: `tests/core/tasks.test.mjs`
- Modify: `src/core/constants.mjs`

- [ ] **Step 1: Write task tests**

Create `tests/core/tasks.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { RUNTIME_STATUSES, TASK_CATEGORIES } from "../../src/core/constants.mjs";
import { completeTask, generateDailyTasks } from "../../src/core/tasks.mjs";

test("generateDailyTasks creates 3 tasks for high load", () => {
  const tasks = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.HIGH_LOAD,
    mainQuest: { title: "地球 Online" },
    customTaskPool: [],
  });

  assert.equal(tasks.length, 3);
  assert.ok(tasks.some((task) => task.category === TASK_CATEGORIES.NPC));
});

test("generateDailyTasks creates 5 tasks for stable operation", () => {
  const tasks = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.STABLE,
    mainQuest: { title: "地球 Online" },
    customTaskPool: [{ title: "整理灵感库", category: TASK_CATEGORIES.ENVIRONMENT, exp: 18 }],
  });

  assert.equal(tasks.length, 5);
  assert.ok(tasks.some((task) => task.title.includes("地球 Online")));
  assert.ok(tasks.some((task) => task.source === "custom"));
});

test("completeTask marks task complete and returns gained EXP", () => {
  const [task] = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.LOW_ENERGY,
    mainQuest: null,
    customTaskPool: [],
  });

  const result = completeTask(task, "2026-06-21T20:24:00+08:00");

  assert.equal(result.task.completed, true);
  assert.equal(result.gainedExp, task.exp);
  assert.equal(result.task.completedAt, "2026-06-21T20:24:00+08:00");
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL with module-not-found for `tasks.mjs`.

- [ ] **Step 3: Add default task pool constants**

Append to `src/core/constants.mjs`:

```js
export const DEFAULT_TASK_POOL = Object.freeze([
  {
    id: "body_low_intensity",
    category: TASK_CATEGORIES.BODY,
    title: "完成 15 分钟低强度运动",
    exp: 20,
    statuses: [RUNTIME_STATUSES.HIGH_LOAD, RUNTIME_STATUSES.LOW_ENERGY, RUNTIME_STATUSES.MAINTENANCE],
  },
  {
    id: "npc_skip_argument",
    category: TASK_CATEGORIES.NPC,
    title: "跳过一次无收益争论",
    exp: 18,
    statuses: [RUNTIME_STATUSES.HIGH_LOAD, RUNTIME_STATUSES.LOW_ENERGY],
  },
  {
    id: "environment_clear_one",
    category: TASK_CATEGORIES.ENVIRONMENT,
    title: "清理一个低价值待办",
    exp: 22,
    statuses: [RUNTIME_STATUSES.HIGH_LOAD, RUNTIME_STATUSES.LOST_ROUTE, RUNTIME_STATUSES.MAINTENANCE],
  },
  {
    id: "input_reading",
    category: TASK_CATEGORIES.INPUT,
    title: "完成 20 分钟阅读",
    exp: 25,
    statuses: [RUNTIME_STATUSES.STABLE, RUNTIME_STATUSES.MAIN_QUEST_PUSH],
  },
  {
    id: "output_small_artifact",
    category: TASK_CATEGORIES.OUTPUT,
    title: "产出一个最小可见作品",
    exp: 32,
    statuses: [RUNTIME_STATUSES.STABLE, RUNTIME_STATUSES.MAIN_QUEST_PUSH],
  },
  {
    id: "route_review",
    category: TASK_CATEGORIES.MAIN_QUEST,
    title: "写下当前主线的下一步动作",
    exp: 24,
    statuses: [RUNTIME_STATUSES.LOST_ROUTE],
  },
]);
```

- [ ] **Step 4: Implement task module**

Create `src/core/tasks.mjs`:

```js
import {
  DEFAULT_TASK_POOL,
  RUNTIME_STATUSES,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
} from "./constants.mjs";

const TASK_COUNTS = Object.freeze({
  [RUNTIME_STATUSES.HIGH_LOAD]: 3,
  [RUNTIME_STATUSES.LOW_ENERGY]: 3,
  [RUNTIME_STATUSES.MAINTENANCE]: 3,
  [RUNTIME_STATUSES.LOST_ROUTE]: 4,
  [RUNTIME_STATUSES.STABLE]: 5,
  [RUNTIME_STATUSES.MAIN_QUEST_PUSH]: 5,
});

export function generateDailyTasks({
  date,
  status,
  mainQuest,
  customTaskPool = [],
}) {
  const count = TASK_COUNTS[status] || 4;
  const selected = [];

  if (mainQuest && shouldIncludeMainQuest(status)) {
    selected.push(createTask({
      id: `main-${date}`,
      category: TASK_CATEGORIES.MAIN_QUEST,
      title: getMainQuestTitle(status, mainQuest.title),
      exp: status === RUNTIME_STATUSES.LOW_ENERGY ? 18 : 35,
      source: "main_quest",
      date,
    }));
  }

  const weighted = DEFAULT_TASK_POOL.filter((task) => task.statuses.includes(status));
  for (const task of weighted) {
    if (selected.length >= count) break;
    selected.push(createTask({ ...task, source: "system", date }));
  }

  for (const task of customTaskPool) {
    if (selected.length >= count) break;
    selected.push(createTask({
      id: `custom-${slug(task.title)}-${date}`,
      category: task.category,
      title: task.title,
      exp: task.exp || 20,
      source: "custom",
      date,
    }));
  }

  for (const task of DEFAULT_TASK_POOL) {
    if (selected.length >= count) break;
    if (selected.some((item) => item.title === task.title)) continue;
    selected.push(createTask({ ...task, source: "system", date }));
  }

  return selected.slice(0, count).map((task, index) => ({
    ...task,
    order: index + 1,
  }));
}

export function completeTask(task, completedAt = new Date().toISOString()) {
  return {
    task: {
      ...task,
      completed: true,
      completedAt,
    },
    gainedExp: task.exp,
  };
}

export function expireTask(task, expiredAt = new Date().toISOString()) {
  return {
    ...task,
    expired: true,
    expiredAt,
  };
}

function createTask({ id, category, title, exp, source, date }) {
  return {
    id,
    date,
    category,
    categoryLabel: TASK_CATEGORY_LABELS[category],
    title,
    exp,
    source,
    completed: false,
    expired: false,
  };
}

function shouldIncludeMainQuest(status) {
  return [
    RUNTIME_STATUSES.STABLE,
    RUNTIME_STATUSES.MAIN_QUEST_PUSH,
    RUNTIME_STATUSES.LOST_ROUTE,
    RUNTIME_STATUSES.LOW_ENERGY,
  ].includes(status);
}

function getMainQuestTitle(status, title) {
  if (status === RUNTIME_STATUSES.LOW_ENERGY) {
    return `完成 10 分钟「${title}」最小推进`;
  }
  if (status === RUNTIME_STATUSES.LOST_ROUTE) {
    return `确认「${title}」的下一步动作`;
  }
  return `完成 25 分钟「${title}」推进`;
}

function slug(value) {
  return String(value).trim().toLowerCase().replace(/\s+/g, "-").slice(0, 24);
}
```

- [ ] **Step 5: Run tests**

Run: `npm test`

Expected: PASS for all core tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/constants.mjs src/core/tasks.mjs tests/core/tasks.test.mjs
git commit -m "feat: add status weighted daily tasks"
```

---

### Task 6: Refactor Bootstrap Into App Controller

**Files:**
- Create: `src/app/controller.mjs`
- Create: `src/app/dom.mjs`
- Modify: `src/main.js`
- Modify: `index.html`

- [ ] **Step 1: Add DOM mount points**

Modify the body of `index.html` so it contains these stable mount points:

```html
<main id="app" aria-label="地球 Online">
  <section class="intro" aria-label="Earth Online intro">
    <div id="globe-stage"></div>
    <div id="home-overlay"></div>
    <div id="system-root" hidden></div>
  </section>
</main>
```

Keep the import map and module script.

- [ ] **Step 2: Create DOM helper**

Create `src/app/dom.mjs`:

```js
export function getDom() {
  return {
    body: document.body,
    stage: mustFind("#globe-stage"),
    homeOverlay: mustFind("#home-overlay"),
    systemRoot: mustFind("#system-root"),
  };
}

export function setSystemVisible(systemRoot, visible) {
  systemRoot.hidden = !visible;
  systemRoot.setAttribute("aria-hidden", String(!visible));
}

function mustFind(selector) {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing required DOM node: ${selector}`);
  }
  return node;
}
```

- [ ] **Step 3: Create controller shell**

Create `src/app/controller.mjs`:

```js
import { getDom, setSystemVisible } from "./dom.mjs";
import { loadLocalSave, saveLocalSave } from "../core/storage.mjs";
import { createEarthScene } from "../scene/earth-scene.mjs";
import { renderHome } from "../ui/home.mjs";
import { renderInitTerminal } from "../ui/init-terminal.mjs";
import { renderSystemPanel } from "../ui/system-panel.mjs";

export function createApp() {
  const dom = getDom();
  const save = loadLocalSave();
  const scene = createEarthScene(dom.stage);
  const state = {
    mode: "home",
    save,
    scene,
  };

  function enter() {
    if (state.mode !== "home") return;
    state.mode = "focusing";
    dom.body.classList.add("is-zooming");
    scene.focus().then(() => {
      if (!state.save.profile) {
        showInit();
      } else {
        showPanel();
      }
    }).catch(() => {
      exitToHome();
    });
  }

  function showInit() {
    state.mode = "init";
    setSystemVisible(dom.systemRoot, true);
    renderInitTerminal(dom.systemRoot, {
      onComplete(nextSave) {
        state.save = saveLocalSave(nextSave);
        showPanel();
      },
      onExit: exitToHome,
    });
  }

  function showPanel() {
    state.mode = "panel";
    setSystemVisible(dom.systemRoot, true);
    renderSystemPanel(dom.systemRoot, {
      save: state.save,
      onChange(nextSave) {
        state.save = saveLocalSave(nextSave);
        renderSystemPanel(dom.systemRoot, {
          save: state.save,
          onChange,
          onExit: exitToHome,
        });
      },
      onExit: exitToHome,
    });
  }

  function onChange(nextSave) {
    state.save = saveLocalSave(nextSave);
  }

  function exitToHome() {
    state.mode = "home";
    dom.body.classList.remove("is-zooming");
    setSystemVisible(dom.systemRoot, false);
    dom.systemRoot.replaceChildren();
    scene.home();
  }

  dom.stage.addEventListener("dblclick", enter);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      exitToHome();
    }
  });

  renderHome(dom.homeOverlay);
  scene.start();

  return { enter, exitToHome, state };
}
```

- [ ] **Step 4: Replace `src/main.js` with bootstrap**

Modify `src/main.js`:

```js
import { createApp } from "./app/controller.mjs";

createApp();
```

- [ ] **Step 5: Run checks**

Run: `node --check src/main.js`

Expected: exit code 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add index.html src/main.js src/app/controller.mjs src/app/dom.mjs
git commit -m "refactor: add app controller state machine"
```

---

### Task 7: Upgrade Earth Scene With Open-source-first Visuals

**Files:**
- Create: `src/scene/earth-scene.mjs`
- Modify: `src/styles.css`
- Modify: `OPEN_SOURCE_REFERENCES.md`
- Add only the visual assets that are actually referenced by `src/scene/earth-scene.mjs` under `assets/`

- [ ] **Step 1: Document visual references**

Append to `OPEN_SOURCE_REFERENCES.md`:

```md

## Globe Visual Implementation

- `three-globe` clouds example, used for cloud layer structure and animation pattern.
  https://github.com/vasturiano/three-globe/tree/master/example/clouds
- `three-globe` custom globe material and day/night concepts, used as reference for brighter material and city-light direction.
  https://github.com/vasturiano/three-globe
- `globe.gl` arcs/rings/satellites examples, used as reference for restrained orbit and satellite-chain visuals.
  https://github.com/vasturiano/globe.gl
```

- [ ] **Step 2: Confirm public assets exist locally**

Run: `Get-ChildItem assets | Select-Object Name, Length`

Expected: `earth-blue-marble.jpg`, `earth-topology.png`, and `clouds.png` exist with nonzero file sizes.

If night-lights texture is added, save it as `assets/earth-night-lights.jpg` and record its public source in `OPEN_SOURCE_REFERENCES.md`.

- [ ] **Step 3: Create scene module**

Create `src/scene/earth-scene.mjs` with these exported methods:

```js
import ThreeGlobe from "https://esm.sh/three-globe?external=three";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js?external=three";

const ASSETS = {
  day: "./assets/earth-blue-marble.jpg",
  bump: "./assets/earth-topology.png",
  clouds: "./assets/clouds.png",
};

export function createEarthScene(stage) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x02070f, 0.0012);

  const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 2400);
  camera.position.set(-54, 42, 360);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.22;

  const world = new THREE.Group();
  world.position.x = window.innerWidth < 760 ? 0 : 118;
  scene.add(world);

  const globe = new ThreeGlobe({ waitForGlobeReady: true, animateIn: true })
    .globeImageUrl(ASSETS.day)
    .bumpImageUrl(ASSETS.bump)
    .showAtmosphere(false)
    .pointsData(createCityLights())
    .pointAltitude(0.006)
    .pointRadius("radius")
    .pointResolution(10)
    .pointColor("color");
  world.add(globe);

  const globeRadius = globe.getGlobeRadius();
  const clouds = createClouds(globeRadius);
  world.add(clouds);
  world.add(createAtmosphere(globeRadius));

  const satellites = createSatelliteChain(globeRadius);
  world.add(satellites);

  scene.add(createStars());
  scene.add(new THREE.AmbientLight(0x8fa8c0, 1.15));

  const sun = new THREE.DirectionalLight(0xffffff, 4.2);
  sun.position.set(-260, 120, 340);
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x78c9ff, 2.1);
  rim.position.set(260, -90, -220);
  scene.add(rim);

  let frame = 0;
  let lastFrameTime = performance.now();
  let animationId = null;
  let focusResolve = null;
  let focusStart = 0;
  let focusFrom = null;
  let mode = "home";

  function start() {
    if (animationId) return;
    animate();
  }

  function home() {
    mode = "home";
    controls.enabled = true;
    controls.autoRotate = true;
    camera.fov = window.innerWidth < 760 ? 45 : 38;
    camera.updateProjectionMatrix();
  }

  function focus() {
    mode = "focus";
    controls.enabled = false;
    controls.autoRotate = false;
    focusStart = performance.now();
    focusFrom = {
      camera: camera.position.clone(),
      worldRotation: world.rotation.clone(),
      fov: camera.fov,
    };

    return new Promise((resolve) => {
      focusResolve = resolve;
    });
  }

  function animate() {
    frame += 1;
    const now = performance.now();
    const delta = Math.min((now - lastFrameTime) / 1000, 0.08);
    lastFrameTime = now;

    if (mode === "home") {
      world.rotation.y += delta * 0.045;
    }

    if (mode === "focus") {
      const t = Math.min((performance.now() - focusStart) / 2400, 1);
      const ease = t * t * (3 - 2 * t);
      camera.position.lerpVectors(focusFrom.camera, new THREE.Vector3(24, 18, 145), ease);
      camera.fov = THREE.MathUtils.lerp(focusFrom.fov, 18, ease);
      camera.updateProjectionMatrix();
      world.rotation.x = THREE.MathUtils.lerp(focusFrom.worldRotation.x, -0.16, ease);
      world.rotation.y = THREE.MathUtils.lerp(focusFrom.worldRotation.y, -1.28, ease);

      if (t === 1 && focusResolve) {
        mode = "panel";
        focusResolve();
        focusResolve = null;
      }
    }

    clouds.rotation.y += delta * 0.018;
    satellites.rotation.y += delta * 0.11;
    controls.update();
    camera.lookAt(world.position);
    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    world.position.x = window.innerWidth < 760 ? 0 : 118;
  }

  window.addEventListener("resize", resize);

  return { start, focus, home };
}

function createClouds(radius) {
  const material = new THREE.MeshPhongMaterial({ color: 0xffffff, transparent: true, opacity: 0.58, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.008, 96, 96), material);
  new THREE.TextureLoader().load(ASSETS.clouds, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    material.map = texture;
    material.needsUpdate = true;
  });
  return mesh;
}

function createAtmosphere(radius) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.08, 96, 96),
    new THREE.ShaderMaterial({
      uniforms: { glowColor: { value: new THREE.Color(0x78d2ff) } },
      vertexShader: "varying vec3 vNormal; void main(){ vNormal = normalize(normalMatrix * normal); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: "uniform vec3 glowColor; varying vec3 vNormal; void main(){ float intensity = pow(0.75 - dot(vNormal, vec3(0.0,0.0,1.0)), 2.15); gl_FragColor = vec4(glowColor, intensity * 0.72); }",
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
}

function createSatelliteChain(radius) {
  const group = new THREE.Group();
  const orbit = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 1.28, 0.035, 8, 160),
    new THREE.MeshBasicMaterial({ color: 0x82d6ff, transparent: true, opacity: 0.28 }),
  );
  orbit.rotation.x = Math.PI * 0.62;
  group.add(orbit);

  for (let index = 0; index < 18; index += 1) {
    const angle = (index / 18) * Math.PI * 2;
    const satellite = new THREE.Mesh(
      new THREE.SphereGeometry(0.78, 12, 12),
      new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? 0xffffff : 0x72cfff }),
    );
    satellite.position.set(Math.cos(angle) * radius * 1.28, 0, Math.sin(angle) * radius * 1.28);
    satellite.rotation.x = orbit.rotation.x;
    group.add(satellite);
  }

  group.rotation.z = -0.28;
  return group;
}

function createCityLights() {
  return [
    { lat: 35.6762, lng: 139.6503, radius: 0.42, color: "#fff1b8" },
    { lat: 31.2304, lng: 121.4737, radius: 0.42, color: "#fff1b8" },
    { lat: 28.6139, lng: 77.209, radius: 0.44, color: "#fff1b8" },
    { lat: 40.7128, lng: -74.006, radius: 0.4, color: "#fff1b8" },
    { lat: 51.5072, lng: -0.1276, radius: 0.38, color: "#fff1b8" },
    { lat: 30.0444, lng: 31.2357, radius: 0.32, color: "#ffe29d" },
    { lat: -23.5558, lng: -46.6396, radius: 0.38, color: "#ffe29d" },
    { lat: 6.5244, lng: 3.3792, radius: 0.34, color: "#ffe29d" },
  ];
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let index = 0; index < 1300; index += 1) {
    const radius = THREE.MathUtils.randFloat(720, 1700);
    const theta = THREE.MathUtils.randFloatSpread(Math.PI * 2);
    const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
    positions.push(radius * Math.sin(phi) * Math.cos(theta), radius * Math.sin(phi) * Math.sin(theta), radius * Math.cos(phi));
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0xdceeff, size: 1.35, transparent: true, opacity: 0.68 }));
}
```

- [ ] **Step 4: Add scene CSS hooks**

Ensure `src/styles.css` has:

```css
#globe-stage {
  position: absolute;
  inset: 0;
  cursor: crosshair;
}

#globe-stage canvas {
  display: block;
  width: 100%;
  height: 100%;
}

body.is-zooming #home-overlay {
  opacity: 0;
  filter: blur(8px);
  transform: translateX(-24px);
}
```

- [ ] **Step 5: Run checks**

Run: `node --check src/scene/earth-scene.mjs`

Expected: exit code 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Browser visual check**

Open `http://127.0.0.1:58804/`.

Expected:

- Earth is visibly brighter than the previous prototype.
- Land, ocean, cloud layer, and atmosphere are visible.
- City-light points are visible.
- Satellite chain or orbit is visible and moving.
- Double-click focuses toward Earth and eventually resolves into the next state instead of getting stuck.

- [ ] **Step 7: Commit**

```bash
git add src/scene/earth-scene.mjs src/styles.css OPEN_SOURCE_REFERENCES.md assets
git commit -m "feat: upgrade earth scene visuals"
```

---

### Task 8: Add Home Overlay And Dynamic Player Count

**Files:**
- Create: `src/ui/home.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Create home UI**

Create `src/ui/home.mjs`:

```js
import { estimatePopulation, formatPopulation } from "../core/population.mjs";

export function renderHome(root) {
  root.className = "home-overlay";
  root.innerHTML = `
    <div class="title-lockup">
      <h1>地球 Online</h1>
      <p>请勿在NPC身上浪费过多时间</p>
    </div>
    <aside class="player-count" aria-live="polite">
      <span>GLOBAL PLAYERS ONLINE</span>
      <strong data-player-count></strong>
      <small>全球在线玩家估算</small>
    </aside>
  `;

  const valueNode = root.querySelector("[data-player-count]");

  function update() {
    valueNode.textContent = formatPopulation(estimatePopulation());
  }

  update();
  const timer = window.setInterval(update, 1000);
  return () => window.clearInterval(timer);
}
```

- [ ] **Step 2: Add CSS**

Add to `src/styles.css`:

```css
.home-overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
  transition: opacity 700ms ease, filter 900ms ease, transform 900ms ease;
}

.player-count {
  position: absolute;
  right: clamp(20px, 5vw, 76px);
  bottom: clamp(24px, 6vw, 72px);
  display: grid;
  gap: 6px;
  color: rgba(230, 246, 255, 0.86);
  text-align: right;
  text-shadow: 0 12px 36px rgba(0, 0, 0, 0.72);
}

.player-count span {
  font-size: 0.72rem;
  letter-spacing: 0.14em;
  color: rgba(125, 207, 255, 0.84);
}

.player-count strong {
  font-variant-numeric: tabular-nums;
  font-size: clamp(1.5rem, 3.2vw, 3.7rem);
  font-weight: 680;
  letter-spacing: 0;
}

.player-count small {
  color: rgba(199, 218, 235, 0.62);
}
```

- [ ] **Step 3: Run checks**

Run: `node --check src/ui/home.mjs`

Expected: exit code 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Browser check**

Open `http://127.0.0.1:58804/`.

Expected:

- `GLOBAL PLAYERS ONLINE` appears as a system readout.
- Number is formatted with commas.
- Number updates once per second.
- Readout does not cover the Earth title.

- [ ] **Step 5: Commit**

```bash
git add src/ui/home.mjs src/styles.css
git commit -m "feat: add global player count readout"
```

---

### Task 9: Build First-run Initialization Terminal

**Files:**
- Create: `src/ui/init-terminal.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Create initialization terminal**

Create `src/ui/init-terminal.mjs`:

```js
import { RUNTIME_STATUSES } from "../core/constants.mjs";
import { createInitialProfileSave } from "../core/profile.mjs";

const STEPS = ["玩家档案", "旧存档导入", "状态校准"];

export function renderInitTerminal(root, { onComplete, onExit }) {
  let step = 0;
  const data = {
    profile: {
      nickname: "",
      gender: { type: "prefer_not_to_say", label: "不透露" },
      selectedTags: [],
      customTags: [],
    },
    importAnswers: {
      ageBand: "adult",
      educationStage: "undergraduate",
      currentStage: "working",
      stableSkillCount: 1,
      mainSkillArea: "technical",
      projectCount: 0,
      resourceStatus: "skip",
      mainQuest: "",
      persistenceRecord: "months",
      setbackRecovery: "recovered",
      lifeMethod: "emerging",
      socialEnergy: "medium",
      runtimeStatus: RUNTIME_STATUSES.STABLE,
    },
  };

  function render() {
    root.innerHTML = `
      <section class="terminal-shell" aria-label="玩家档案初始化">
        <button class="terminal-exit" type="button" aria-label="返回首页">×</button>
        <header>
          <span>PLAYER PROFILE INITIALIZATION</span>
          <strong>STEP ${String(step + 1).padStart(2, "0")} / 03 · ${STEPS[step]}</strong>
        </header>
        <form class="terminal-form">${renderStep(step, data)}</form>
        <footer>
          <button type="button" data-action="back" ${step === 0 ? "disabled" : ""}>返回</button>
          <button type="button" data-action="next">${step === 2 ? "导入旧存档" : "继续"}</button>
        </footer>
      </section>
    `;

    root.querySelector(".terminal-exit").addEventListener("click", onExit);
    root.querySelector("[data-action='back']").addEventListener("click", () => {
      readStep(root, step, data);
      step = Math.max(0, step - 1);
      render();
    });
    root.querySelector("[data-action='next']").addEventListener("click", () => {
      readStep(root, step, data);
      if (step < 2) {
        step += 1;
        render();
        return;
      }
      onComplete(createInitialProfileSave(data));
    });
  }

  render();
}

function renderStep(step, data) {
  if (step === 0) {
    return `
      <label>昵称 <input name="nickname" value="${escapeHtml(data.profile.nickname)}" required /></label>
      <label>性别
        <select name="gender">
          <option value="male">男</option>
          <option value="female">女</option>
          <option value="non_binary">非二元</option>
          <option value="custom">自定义</option>
          <option value="prefer_not_to_say" selected>不透露</option>
        </select>
      </label>
      <label>人格 / 运行标签 <input name="tags" value="${data.profile.selectedTags.join(", ")}" placeholder="观察者, 长期主义, INTP" /></label>
      <label>自定义标签 <input name="customTags" value="${data.profile.customTags.join(", ")}" placeholder="低耗能, NPC过滤器" /></label>
    `;
  }

  if (step === 1) {
    return `
      <label>年龄区间 <select name="ageBand"><option value="young_adult">青年</option><option value="adult" selected>成年</option><option value="mature">成熟玩家</option></select></label>
      <label>学历阶段 <select name="educationStage"><option value="high_school">高中/同等</option><option value="undergraduate" selected>本科/同等</option><option value="graduate">研究生及以上</option></select></label>
      <label>当前阶段 <select name="currentStage"><option value="studying">学习中</option><option value="working" selected>工作/稳定推进</option><option value="exploring">探索中</option></select></label>
      <label>稳定技能数量 <input name="stableSkillCount" type="number" min="0" max="20" value="${data.importAnswers.stableSkillCount}" /></label>
      <label>作品 / 项目数量 <input name="projectCount" type="number" min="0" max="99" value="${data.importAnswers.projectCount}" /></label>
      <label>当前主线 <input name="mainQuest" value="${escapeHtml(data.importAnswers.mainQuest)}" placeholder="可跳过" /></label>
    `;
  }

  return `
    <label>长期坚持记录 <select name="persistenceRecord"><option value="weeks">数周</option><option value="months" selected>数月</option><option value="years">数年</option></select></label>
    <label>挫折恢复记录 <select name="setbackRecovery"><option value="recovering">恢复中</option><option value="recovered" selected>已恢复</option><option value="repeated_recovery">多次恢复</option></select></label>
    <label>人生方法论 <select name="lifeMethod"><option value="emerging" selected>正在形成</option><option value="clear_method">较清晰</option><option value="reusable_system">可复用系统</option></select></label>
    <label>社交能耗 <select name="socialEnergy"><option value="medium" selected>中等</option><option value="low">低耗能</option><option value="depleted">电量偏低</option></select></label>
    <label>当前状态 <select name="runtimeStatus"><option value="${RUNTIME_STATUSES.STABLE}" selected>稳定运行</option><option value="${RUNTIME_STATUSES.HIGH_LOAD}">高负载</option><option value="${RUNTIME_STATUSES.LOW_ENERGY}">低能量</option><option value="${RUNTIME_STATUSES.LOST_ROUTE}">迷航</option><option value="${RUNTIME_STATUSES.MAINTENANCE}">维护中</option></select></label>
  `;
}

function readStep(root, step, data) {
  const form = root.querySelector(".terminal-form");
  const formData = new FormData(form);

  if (step === 0) {
    data.profile.nickname = String(formData.get("nickname") || "未命名玩家");
    data.profile.gender = getGender(String(formData.get("gender") || "prefer_not_to_say"));
    data.profile.selectedTags = splitTags(formData.get("tags"));
    data.profile.customTags = splitTags(formData.get("customTags"));
  }

  if (step === 1) {
    data.importAnswers.ageBand = String(formData.get("ageBand"));
    data.importAnswers.educationStage = String(formData.get("educationStage"));
    data.importAnswers.currentStage = String(formData.get("currentStage"));
    data.importAnswers.stableSkillCount = Number(formData.get("stableSkillCount") || 0);
    data.importAnswers.projectCount = Number(formData.get("projectCount") || 0);
    data.importAnswers.mainQuest = String(formData.get("mainQuest") || "");
  }

  if (step === 2) {
    data.importAnswers.persistenceRecord = String(formData.get("persistenceRecord"));
    data.importAnswers.setbackRecovery = String(formData.get("setbackRecovery"));
    data.importAnswers.lifeMethod = String(formData.get("lifeMethod"));
    data.importAnswers.socialEnergy = String(formData.get("socialEnergy"));
    data.importAnswers.runtimeStatus = String(formData.get("runtimeStatus"));
  }
}

function splitTags(value) {
  return String(value || "").split(/[，,]/).map((item) => item.trim()).filter(Boolean);
}

function getGender(type) {
  const labels = { male: "男", female: "女", non_binary: "非二元", custom: "自定义", prefer_not_to_say: "不透露" };
  return { type, label: labels[type] || "不透露" };
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
```

- [ ] **Step 2: Add terminal CSS**

Add to `src/styles.css`:

```css
#system-root {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: grid;
  place-items: center;
  padding: clamp(16px, 4vw, 48px);
}

.terminal-shell {
  position: relative;
  width: min(880px, 100%);
  border: 1px solid rgba(120, 210, 255, 0.28);
  background: rgba(4, 13, 22, 0.76);
  backdrop-filter: blur(18px);
  color: rgba(242, 249, 255, 0.94);
  box-shadow: 0 32px 120px rgba(0, 0, 0, 0.55);
  padding: clamp(18px, 3vw, 32px);
}

.terminal-exit {
  position: absolute;
  right: 14px;
  top: 12px;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(142, 217, 255, 0.24);
  background: rgba(0, 0, 0, 0.24);
  color: rgba(229, 246, 255, 0.84);
}

.terminal-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin: 28px 0;
}

.terminal-form label {
  display: grid;
  gap: 7px;
  color: rgba(198, 220, 236, 0.72);
  font-size: 0.82rem;
}

.terminal-form input,
.terminal-form select {
  min-height: 40px;
  border: 1px solid rgba(125, 203, 255, 0.22);
  background: rgba(4, 10, 16, 0.78);
  color: rgba(244, 250, 255, 0.94);
  padding: 0 12px;
}

.terminal-shell footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
```

- [ ] **Step 3: Run checks**

Run: `node --check src/ui/init-terminal.mjs`

Expected: exit code 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Browser check**

Clear local save in devtools or run this in the browser console:

```js
localStorage.removeItem("earth-online-save-v1");
```

Open the app and double-click home.

Expected:

- Focus animation ends in initialization terminal.
- Three steps are navigable.
- Submitting creates a local save.
- `Esc` or the `×` exits to home.

- [ ] **Step 5: Commit**

```bash
git add src/ui/init-terminal.mjs src/styles.css
git commit -m "feat: add first run initialization terminal"
```

---

### Task 10: Build Task-first System Panel

**Files:**
- Create: `src/ui/system-panel.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Create system panel**

Create `src/ui/system-panel.mjs`:

```js
import { STATUS_LABELS } from "../core/constants.mjs";
import { applyExp } from "../core/progression.mjs";
import { completeTask, generateDailyTasks } from "../core/tasks.mjs";

export function renderSystemPanel(root, { save, onChange, onExit }) {
  const today = new Date().toISOString().slice(0, 10);
  const tasks = getOrCreateTodayTasks(save, today);
  const displayTags = getDisplayTags(save);
  const title = save.settings.selectedTitle || save.titles[0] || "未命名玩家";

  root.innerHTML = `
    <section class="system-panel" aria-label="每日任务系统面板">
      <button class="terminal-exit" type="button" aria-label="返回首页">×</button>
      <header class="panel-status">
        <div>
          <span>${escapeHtml(save.profile.nickname)}</span>
          <strong>Lv.${save.level.value} · ${escapeHtml(title)}</strong>
        </div>
        <div>
          <span>STATUS</span>
          <strong>${STATUS_LABELS[save.currentStatus] || "未知"}</strong>
        </div>
      </header>
      <div class="level-progress" aria-label="等级进度">
        <span style="width:${Math.round((save.level.progress || 0) * 100)}%"></span>
      </div>
      <div class="tag-strip">${displayTags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>
      <section class="daily-tasks">
        <header>
          <span>DAILY TASKS ISSUED</span>
          <strong>每日任务已发布</strong>
        </header>
        ${tasks.map(renderTask).join("")}
      </section>
      <footer class="panel-actions">
        <button type="button" data-action="export">导出存档</button>
        <label class="import-button">导入存档<input type="file" accept="application/json" data-action="import" /></label>
      </footer>
    </section>
  `;

  root.querySelector(".terminal-exit").addEventListener("click", onExit);
  root.querySelectorAll("[data-complete-task]").forEach((button) => {
    button.addEventListener("click", () => {
      const id = button.getAttribute("data-complete-task");
      const nextSave = completeTaskInSave(save, id);
      onChange(nextSave);
    });
  });
  root.querySelector("[data-action='export']").addEventListener("click", () => {
    root.dispatchEvent(new CustomEvent("earth-online-export", { bubbles: true }));
  });
  root.querySelector("[data-action='import']").addEventListener("change", (event) => {
    root.dispatchEvent(new CustomEvent("earth-online-import", { bubbles: true, detail: event.target.files[0] }));
  });
}

function getOrCreateTodayTasks(save, today) {
  const existing = save.dailyTasks.filter((task) => task.date === today);
  if (existing.length) {
    return existing;
  }

  const generated = generateDailyTasks({
    date: today,
    status: save.currentStatus,
    mainQuest: save.mainQuest,
    customTaskPool: save.customTaskPool,
  });
  save.dailyTasks = generated;
  return generated;
}

function completeTaskInSave(save, id) {
  const tasks = save.dailyTasks.map((task) => {
    if (task.id !== id || task.completed) {
      return task;
    }
    return completeTask(task).task;
  });
  const completed = tasks.find((task) => task.id === id);
  const gainedExp = completed?.exp || 0;

  return {
    ...save,
    dailyTasks: tasks,
    taskHistory: [...save.taskHistory, completed],
    level: applyExp(save.level, gainedExp),
  };
}

function renderTask(task) {
  return `
    <article class="task-row ${task.completed ? "is-complete" : ""}">
      <div>
        <span>${String(task.order).padStart(2, "0")} ${escapeHtml(task.categoryLabel)}</span>
        <strong>${escapeHtml(task.title)}</strong>
      </div>
      <small>+${task.exp} EXP</small>
      <button type="button" data-complete-task="${task.id}" ${task.completed ? "disabled" : ""}>完成</button>
    </article>
  `;
}

function getDisplayTags(save) {
  const fixed = save.settings.fixedTags || [];
  const hidden = new Set(save.settings.hiddenTags || []);
  const recommended = save.tags.filter((tag) => !hidden.has(tag));
  return [...new Set([...fixed, ...recommended])].slice(0, 5);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
```

- [ ] **Step 2: Add panel CSS**

Add to `src/styles.css`:

```css
.system-panel {
  width: min(1080px, 100%);
  border: 1px solid rgba(120, 210, 255, 0.26);
  background: linear-gradient(135deg, rgba(4, 13, 22, 0.82), rgba(4, 18, 28, 0.66));
  backdrop-filter: blur(18px);
  color: rgba(244, 250, 255, 0.94);
  padding: clamp(18px, 3vw, 32px);
}

.panel-status {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  margin-bottom: 18px;
}

.panel-status div {
  display: grid;
  gap: 5px;
}

.panel-status span,
.daily-tasks header span {
  color: rgba(125, 207, 255, 0.78);
  font-size: 0.72rem;
  letter-spacing: 0.12em;
}

.panel-status strong {
  font-size: clamp(1.1rem, 2.4vw, 2rem);
  font-weight: 620;
}

.level-progress {
  height: 6px;
  background: rgba(124, 190, 232, 0.15);
  overflow: hidden;
}

.level-progress span {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, rgba(112, 210, 255, 0.9), rgba(242, 250, 255, 0.9));
}

.tag-strip {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 24px;
}

.tag-strip span {
  border: 1px solid rgba(133, 213, 255, 0.22);
  color: rgba(214, 233, 246, 0.82);
  padding: 5px 9px;
}

.daily-tasks {
  display: grid;
  gap: 10px;
}

.task-row {
  display: grid;
  grid-template-columns: 1fr auto auto;
  align-items: center;
  gap: 14px;
  border: 1px solid rgba(125, 203, 255, 0.14);
  background: rgba(0, 8, 14, 0.42);
  padding: 12px;
}

.task-row div {
  display: grid;
  gap: 5px;
}

.task-row.is-complete {
  opacity: 0.58;
}

.panel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.import-button input {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  opacity: 0;
}
```

- [ ] **Step 3: Run checks**

Run: `node --check src/ui/system-panel.mjs`

Expected: exit code 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 4: Browser check**

Use a completed profile from Task 9.

Expected:

- Returning user sees system panel after double-click.
- Panel prioritizes daily tasks.
- Task count matches the current status.
- Completing a task increases EXP and progress.
- `×` and `Esc` return to home.

- [ ] **Step 5: Commit**

```bash
git add src/ui/system-panel.mjs src/styles.css
git commit -m "feat: add task first system panel"
```

---

### Task 11: Wire JSON Export And Import

**Files:**
- Modify: `src/app/controller.mjs`
- Modify: `src/ui/system-panel.mjs`
- Modify: `src/core/storage.mjs`

- [ ] **Step 1: Add browser export helpers**

Append to `src/core/storage.mjs`:

```js
export function downloadSaveJson(save, documentRef = document) {
  const blob = new Blob([exportSave({ ...save, exportedAt: new Date().toISOString() })], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = documentRef.createElement("a");
  link.href = url;
  link.download = `earth-online-save-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readSaveFile(file) {
  if (!file) {
    throw new Error("No save file selected");
  }
  return file.text();
}
```

- [ ] **Step 2: Wire controller events**

Modify imports in `src/app/controller.mjs`:

```js
import {
  downloadSaveJson,
  importSave,
  loadLocalSave,
  readSaveFile,
  saveLocalSave,
} from "../core/storage.mjs";
```

Add after `renderHome(dom.homeOverlay);`:

```js
  dom.systemRoot.addEventListener("earth-online-export", () => {
    downloadSaveJson(state.save);
  });

  dom.systemRoot.addEventListener("earth-online-import", async (event) => {
    try {
      const text = await readSaveFile(event.detail);
      state.save = saveLocalSave(importSave(text, state.save));
      showPanel();
    } catch (error) {
      dom.systemRoot.dataset.systemMessage = error.message;
    }
  });
```

- [ ] **Step 3: Surface import error in panel**

In `src/ui/system-panel.mjs`, near the panel footer, render:

```js
const systemMessage = root.dataset.systemMessage || "";
```

Inside the footer template, add:

```html
${systemMessage ? `<p class="system-message">${escapeHtml(systemMessage)}</p>` : ""}
```

- [ ] **Step 4: Add message CSS**

Add to `src/styles.css`:

```css
.system-message {
  margin: 0 auto 0 0;
  color: rgba(255, 190, 150, 0.86);
  font-size: 0.85rem;
}
```

- [ ] **Step 5: Run checks**

Run: `node --check src/app/controller.mjs`

Expected: exit code 0.

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Browser check**

Expected:

- Export button downloads readable JSON.
- Importing the exported JSON restores profile and panel.
- Importing invalid JSON shows a concise error and does not destroy the current local save.

- [ ] **Step 7: Commit**

```bash
git add src/app/controller.mjs src/ui/system-panel.mjs src/core/storage.mjs src/styles.css
git commit -m "feat: add save import export"
```

---

### Task 12: Add Achievement Unlocks For Task Completion

**Files:**
- Modify: `src/core/progression.mjs`
- Modify: `src/ui/system-panel.mjs`
- Modify: `tests/core/progression.test.mjs`

- [ ] **Step 1: Add achievement test**

Append to `tests/core/progression.test.mjs`:

```js
import { unlockRuntimeAchievements } from "../../src/core/progression.mjs";

test("unlockRuntimeAchievements unlocks NPC filter achievement", () => {
  const save = {
    achievements: [],
    titles: [],
    tags: [],
    taskHistory: [
      { category: "npc_noise_reduction", completed: true },
      { category: "npc_noise_reduction", completed: true },
      { category: "npc_noise_reduction", completed: true },
    ],
  };

  const next = unlockRuntimeAchievements(save, "2026-06-21T20:24:00+08:00");

  assert.ok(next.achievements.some((item) => item.id === "npc_filter"));
  assert.ok(next.titles.includes("NPC过滤器"));
  assert.ok(next.tags.includes("NPC过滤器"));
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`

Expected: FAIL because `unlockRuntimeAchievements` is not exported.

- [ ] **Step 3: Implement unlock logic**

Append to `src/core/progression.mjs`:

```js
export function unlockRuntimeAchievements(save, now = new Date().toISOString()) {
  const achievementIds = new Set(save.achievements.map((item) => item.id));
  const next = {
    ...save,
    achievements: [...save.achievements],
    titles: [...save.titles],
    tags: [...save.tags],
  };

  const completedNpcTasks = save.taskHistory.filter(
    (task) => task.completed && task.category === "npc_noise_reduction",
  ).length;

  if (completedNpcTasks >= 3 && !achievementIds.has("npc_filter")) {
    next.achievements.push({
      id: "npc_filter",
      label: "拒绝无效消耗",
      rarity: getRarity("npc_filter", 4.0, 12.0),
      rarityLabel: "全服",
      source: "runtime",
      unlockedAt: now,
    });
    next.titles = unique([...next.titles, "NPC过滤器"]);
    next.tags = unique([...next.tags, "NPC过滤器"]);
  }

  return next;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
```

- [ ] **Step 4: Call unlock logic after task completion**

Modify `src/ui/system-panel.mjs`:

```js
import { applyExp, unlockRuntimeAchievements } from "../core/progression.mjs";
```

In `completeTaskInSave`, replace the return object with:

```js
  return unlockRuntimeAchievements({
    ...save,
    dailyTasks: tasks,
    taskHistory: [...save.taskHistory, completed],
    level: applyExp(save.level, gainedExp),
  });
```

- [ ] **Step 5: Run tests and browser check**

Run: `npm test`

Expected: PASS.

In browser, complete three NPC tasks across generated saves or temporary test data.

Expected: `NPC过滤器` appears in titles/tags after the achievement unlock.

- [ ] **Step 6: Commit**

```bash
git add src/core/progression.mjs src/ui/system-panel.mjs tests/core/progression.test.mjs
git commit -m "feat: unlock runtime achievements"
```

---

### Task 13: Final Visual Polish And Responsive QA

**Files:**
- Modify: `src/styles.css`
- Modify: `src/scene/earth-scene.mjs`
- Modify: `OPEN_SOURCE_REFERENCES.md` if any asset/reference changes

- [ ] **Step 1: Desktop visual QA**

Open `http://127.0.0.1:58804/` in the in-app browser.

Expected:

- Earth is bright and legible.
- City-light points are visible.
- Satellite chain is visible and not visually noisy.
- Title and player count are readable.
- Double-click never leaves a blank stuck screen.
- Panel is readable over the dim Earth background.

- [ ] **Step 2: Mobile-size CSS review**

Inspect CSS rules for `@media (max-width: 760px)`.

Ensure:

```css
@media (max-width: 760px) {
  .title-lockup {
    left: 22px;
    right: 22px;
    bottom: 42px;
    top: auto;
    max-width: none;
    transform: none;
  }

  .player-count {
    left: 22px;
    right: 22px;
    bottom: 152px;
    text-align: left;
  }

  .terminal-form,
  .panel-status,
  .task-row {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Run verification commands**

Run: `npm test`

Expected: PASS.

Run:

```powershell
node --check src/main.js
node --check src/app/controller.mjs
node --check src/scene/earth-scene.mjs
node --check src/ui/home.mjs
node --check src/ui/init-terminal.mjs
node --check src/ui/system-panel.mjs
```

Expected: all commands exit 0.

- [ ] **Step 4: Browser interaction checklist**

Verify manually:

- Fresh localStorage opens initialization after double-click.
- Completed initialization saves data.
- Reloading the page keeps the profile.
- Returning user opens task panel after double-click.
- Completing a task increases EXP.
- Export downloads JSON.
- Import restores JSON.
- `×` returns home.
- `Esc` returns home.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css src/scene/earth-scene.mjs OPEN_SOURCE_REFERENCES.md
git commit -m "polish: refine earth online mvp visuals"
```

---

## Final Verification

Run:

```powershell
npm test
node --check src/main.js
node --check src/app/controller.mjs
node --check src/scene/earth-scene.mjs
node --check src/ui/home.mjs
node --check src/ui/init-terminal.mjs
node --check src/ui/system-panel.mjs
```

Expected:

- All tests pass.
- All syntax checks exit 0.
- Browser QA confirms the home scene, initialization, system panel, task completion, exit flow, export, and import.

## Execution Notes

- Keep commits small and scoped to each task.
- Do not commit unrelated `.superpowers/` brainstorm files.
- Do not commit generated image assets unless they are actually used by the app and documented in `OPEN_SOURCE_REFERENCES.md`.
- When visual behavior differs from this plan because a `three-globe` example has a better pattern, update this plan or the implementation notes before coding the alternative.
