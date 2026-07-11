# Night Archive v0.2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first complete 12-achievement Night Archive with a real Earth day/night transition, old-save confirmation, visible rarity, fixed record rates, unified GPT Image 2 assets, and queued unlock notifications.

**Architecture:** Keep static achievement definitions, player archive state, transition timing, Three.js rendering, and DOM views in separate modules. The app controller coordinates modes and persistence, while pure core functions remain testable with `node:test`; visual behavior is verified in the in-app browser at desktop and mobile sizes.

**Tech Stack:** Native browser ES modules, Three.js and three-globe, HTML/CSS, Node.js built-in test runner, GPT Image 2 through the installed imagegen skill.

---

## File Structure

Create these focused modules:

- `src/core/achievement-catalog.mjs`: 12 static definitions, categories, fixed record rates, and rarity-tier lookup.
- `src/core/achievements.mjs`: archive defaults, candidate generation, confirmation, dismissal, revocation, visibility, representative selection, and legacy-ID compatibility.
- `src/core/night-transition.mjs`: deterministic transition duration and persisted switch metadata.
- `src/ui/night-archive.mjs`: archive shell, filters, cards, detail view, and day-mode control.
- `src/ui/old-save-review.mjs`: candidate review and batch-recovery completion UI.
- `src/ui/achievement-toast.mjs`: sequential unlock-notification queue.
- `src/styles/achievements.css`: all Night Archive, review, transition, rarity, and toast styles.
- `tests/core/achievement-catalog.test.mjs`: catalog and rarity contracts.
- `tests/core/achievements.test.mjs`: archive mutations and representative selection.
- `tests/core/night-transition.test.mjs`: duration and switch-count rules.
- `tests/ui/night-archive.test.mjs`: pure archive view-model filtering and ordering.
- `tests/ui/achievement-toast.test.mjs`: achievement-delta detection and queue ordering.
- `assets/achievements/*.png`: 12 normalized 1024px GPT Image 2 source icons.

Modify these existing files:

- `src/core/storage.mjs`: add and normalize `achievementArchive` while preserving old and unknown achievements.
- `src/core/profile.mjs`: create initial candidate IDs instead of auto-awarding the 12 old-save records.
- `src/core/progression.mjs`: emit the canonical new achievement instance shape for runtime unlocks.
- `src/scene/earth-scene.mjs`: expose cancellable `toNight()` and `toDay()` scene transitions.
- `src/ui/system-panel.mjs`: add the moon-phase archive entry and callback.
- `src/app/controller.mjs`: coordinate panel, transition, review, archive, save, and toast modes.
- `index.html`: load `src/styles/achievements.css` after the current stylesheet.

Do not split or rewrite the existing morning-panel CSS during this feature. Keep unrelated repair files and current uncommitted UI work out of feature commits.

### Task 1: Add the Versioned Achievement Catalog

**Files:**
- Create: `src/core/achievement-catalog.mjs`
- Create: `tests/core/achievement-catalog.test.mjs`

- [ ] **Step 1: Write the failing catalog contract test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_CATALOG,
  getAchievementDefinition,
  getRarityTier,
} from "../../src/core/achievement-catalog.mjs";

test("v0.2 catalog contains 12 unique fixed-rate achievements", () => {
  assert.equal(ACHIEVEMENT_CATALOG.length, 12);
  assert.equal(new Set(ACHIEVEMENT_CATALOG.map((item) => item.id)).size, 12);
  assert.equal(getAchievementDefinition("paid-home").rarityPercent, 4);
  assert.equal(getAchievementDefinition("driver-license-hunter").rarityPercent, 53);
});

test("rarity tiers follow the approved fixed boundaries", () => {
  assert.equal(getRarityTier(71).id, "common");
  assert.equal(getRarityTier(38).id, "precious");
  assert.equal(getRarityTier(11).id, "rare");
  assert.equal(getRarityTier(4).id, "ultra_rare");
  assert.equal(getRarityTier(0.7).id, "world_record");
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run: `node --test tests/core/achievement-catalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `achievement-catalog.mjs`.

- [ ] **Step 3: Implement the catalog and rarity lookup**

```js
export const ACHIEVEMENT_CATALOG_VERSION = 2;

export const ACHIEVEMENT_CATALOG = Object.freeze([
  define("academic-complete", "学有所成", "完成高等教育副本，取得一份正式毕业记录。", "learning", 38, "academic-complete.png", ["education_undergraduate", "education_graduate"]),
  define("driver-license-hunter", "驾照猎人", "通过驾考专属副本，解锁机动车驾驶权限。", "exploration", 53, "driver-license-hunter.png"),
  define("cooking-awakened", "厨艺觉醒", "不依赖外卖，独立完成一桌家常菜。", "skills", 62, "cooking-awakened.png"),
  define("first-love", "初恋支线", "触发人生第一次真切心动的关系剧情。", "relationships", 71, "first-love.png"),
  define("first-job", "第一份工", "首次接入职业主线，获得一份正式工作记录。", "career", 71, "first-job.png", ["stage_working", "stage_freelancing"]),
  define("overseas-checkin", "海外打卡", "完成一次跨服旅行，留下境外地图记录。", "exploration", 11, "overseas-checkin.png"),
  define("true-bond", "真心羁绊", "拥有一段经历时间验证、可以彼此信任的友情。", "relationships", 13, "true-bond.png"),
  define("self-rescue", "自我救赎", "在低谷期完成自我调节，重新恢复运行。", "growth", 67, "self-rescue.png", ["setback_recovered", "setback_repeated_recovery"]),
  define("keep-passion", "守住热爱", "让一件真正喜欢的事穿过时间，仍然留在生活里。", "skills", 13, "keep-passion.png"),
  define("wilderness-camp", "山野露营", "在城市边界之外完成一次户外过夜。", "exploration", 10.3, "wilderness-camp.png"),
  define("financial-freedom", "财富自由", "资源储备足以让生存不再占据全部主线。", "resources", 5.2, "financial-freedom.png"),
  define("paid-home", "全款置业", "在没有住房贷款的情况下取得一处房产。", "resources", 4, "paid-home.png"),
]);

export function getAchievementDefinition(id) {
  return ACHIEVEMENT_CATALOG.find((item) => item.id === id) || null;
}

export function getRarityTier(percent) {
  const value = Number(percent);
  if (value < 1) return { id: "world_record", label: "世界级记录" };
  if (value < 5) return { id: "ultra_rare", label: "极稀有记录" };
  if (value < 20) return { id: "rare", label: "稀有记录" };
  if (value < 50) return { id: "precious", label: "珍贵记录" };
  return { id: "common", label: "常见记录" };
}

function define(id, title, description, category, rarityPercent, iconFile, oldSaveSignals = []) {
  return Object.freeze({
    id,
    title,
    description,
    category,
    rarityPercent,
    iconAsset: `./assets/achievements/${iconFile}`,
    oldSaveSignals: Object.freeze(oldSaveSignals),
  });
}
```

- [ ] **Step 4: Run the catalog tests**

Run: `node --test tests/core/achievement-catalog.test.mjs`

Expected: 2 tests PASS.

- [ ] **Step 5: Commit the catalog slice**

```powershell
git add src/core/achievement-catalog.mjs tests/core/achievement-catalog.test.mjs
git commit -m "feat: add night archive achievement catalog"
```

### Task 2: Add Archive State and Backward-Compatible Save Normalization

**Files:**
- Create: `src/core/achievements.mjs`
- Create: `tests/core/achievements.test.mjs`
- Modify: `src/core/storage.mjs`
- Modify: `tests/core/storage.test.mjs`

- [ ] **Step 1: Write failing archive-default and migration tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyAchievementArchive,
  getAchievementInstanceId,
} from "../../src/core/achievements.mjs";

test("empty archive starts pending without inventing unlocks", () => {
  assert.deepEqual(createEmptyAchievementArchive(), {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
  });
});

test("achievement instance IDs accept legacy and canonical records", () => {
  assert.equal(getAchievementInstanceId({ id: "legacy" }), "legacy");
  assert.equal(getAchievementInstanceId({ achievementId: "canonical" }), "canonical");
});
```

Append to `tests/core/storage.test.mjs`:

```js
test("importSave adds archive defaults and preserves unknown legacy achievements", () => {
  const legacy = createEmptySave("2026-07-11T00:00:00.000Z");
  delete legacy.achievementArchive;
  legacy.achievements = [{ id: "unknown-old-record", label: "保留我" }];

  const imported = importSave(JSON.stringify(legacy));

  assert.equal(imported.achievementArchive.scanStatus, "pending");
  assert.equal(imported.achievements[0].id, "unknown-old-record");
});
```

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests/core/achievements.test.mjs tests/core/storage.test.mjs`

Expected: FAIL because the archive module/default field does not exist.

- [ ] **Step 3: Implement archive defaults and compatibility accessors**

```js
export function createEmptyAchievementArchive() {
  return {
    version: 1,
    scanStatus: "pending",
    candidateIds: [],
    dismissedIds: [],
    firstNightEnteredAt: null,
    lastSwitchDate: null,
    switchCount: 0,
    lastRecovery: null,
  };
}

export function getAchievementInstanceId(instance) {
  return String(instance?.achievementId || instance?.id || "").trim();
}

export function normalizeAchievementArchive(value) {
  const defaults = createEmptyAchievementArchive();
  const archive = value && typeof value === "object" ? value : {};
  return {
    ...defaults,
    ...archive,
    candidateIds: stringArray(archive.candidateIds),
    dismissedIds: stringArray(archive.dismissedIds),
  };
}

function stringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.map(String).map((item) => item.trim()).filter(Boolean))]
    : [];
}
```

In `src/core/storage.mjs`, import the helpers, add `achievementArchive` to `createEmptySave()`, and merge it explicitly:

```js
import {
  createEmptyAchievementArchive,
  normalizeAchievementArchive,
} from "./achievements.mjs";

// createEmptySave return value
achievementArchive: createEmptyAchievementArchive(),

// mergeWithDefaults return value
achievementArchive: normalizeAchievementArchive(save.achievementArchive),
```

Leave the existing `achievements` array untouched so unknown IDs survive import/export.

- [ ] **Step 4: Run archive and storage tests**

Run: `node --test tests/core/achievements.test.mjs tests/core/storage.test.mjs`

Expected: all selected tests PASS.

- [ ] **Step 5: Run the complete regression suite**

Run: `npm.cmd test`

Expected: all existing and new tests PASS.

- [ ] **Step 6: Commit the save-schema slice**

```powershell
git add src/core/achievements.mjs src/core/storage.mjs tests/core/achievements.test.mjs tests/core/storage.test.mjs
git commit -m "feat: add backward compatible archive state"
```

### Task 3: Implement Candidate, Confirmation, Privacy, and Recovery Rules

**Files:**
- Modify: `src/core/achievements.mjs`
- Modify: `tests/core/achievements.test.mjs`
- Modify: `src/core/profile.mjs`
- Modify: `tests/core/profile.test.mjs`

- [ ] **Step 1: Add failing behavior tests**

```js
import {
  completeOldSaveReview,
  confirmOldSaveAchievement,
  dismissOldSaveAchievement,
  getOldSaveCandidateIds,
  revokeOldSaveAchievement,
  setAchievementPresentation,
} from "../../src/core/achievements.mjs";

test("candidate generation only uses strong onboarding signals", () => {
  assert.deepEqual(getOldSaveCandidateIds({
    educationStage: "undergraduate",
    currentStage: "working",
    setbackRecovery: "recovered",
  }), ["academic-complete", "first-job", "self-rescue"]);
});

test("old-save confirmation is reversible and never duplicates records", () => {
  const save = {
    achievements: [],
    achievementArchive: {
      ...createEmptyAchievementArchive(),
      scanStatus: "review",
      candidateIds: ["academic-complete"],
    },
  };
  const once = confirmOldSaveAchievement(save, "academic-complete", "2026-07-11T01:00:00.000Z");
  const twice = confirmOldSaveAchievement(once, "academic-complete", "2026-07-11T02:00:00.000Z");
  const hidden = setAchievementPresentation(twice, "academic-complete", { hidden: true });
  const revoked = revokeOldSaveAchievement(hidden, "academic-complete");

  assert.equal(once.achievements.length, 1);
  assert.equal(twice.achievements.length, 1);
  assert.equal(hidden.achievements[0].hidden, true);
  assert.equal(revoked.achievements.length, 0);
  assert.ok(revoked.achievementArchive.candidateIds.includes("academic-complete"));
});

test("review completion chooses one visible representative", () => {
  let save = { achievements: [], achievementArchive: createEmptyAchievementArchive() };
  save = confirmOldSaveAchievement(save, "driver-license-hunter");
  save = confirmOldSaveAchievement(save, "paid-home");
  save = setAchievementPresentation(save, "paid-home", { spotlightAllowed: false });
  const completed = completeOldSaveReview(save, "2026-07-11T03:00:00.000Z");

  assert.equal(completed.achievementArchive.scanStatus, "complete");
  assert.equal(completed.achievementArchive.lastRecovery.count, 2);
  assert.equal(completed.achievementArchive.lastRecovery.representativeId, "driver-license-hunter");
});
```

Append to `tests/core/profile.test.mjs`:

```js
test("createInitialProfileSave stores old-save candidates for later confirmation", () => {
  const save = createInitialProfileSave({
    importAnswers: {
      educationStage: "graduate",
      currentStage: "working",
      setbackRecovery: "repeated_recovery",
    },
  });

  assert.equal(save.achievementArchive.scanStatus, "review");
  assert.deepEqual(save.achievementArchive.candidateIds, [
    "academic-complete",
    "first-job",
    "self-rescue",
  ]);
  assert.equal(save.achievements.some((item) => item.achievementId === "academic-complete"), false);
});
```

- [ ] **Step 2: Run the tests and verify missing-export failures**

Run: `node --test tests/core/achievements.test.mjs tests/core/profile.test.mjs`

Expected: FAIL because the new archive operations are not exported.

- [ ] **Step 3: Implement pure archive mutations**

Use `getAchievementDefinition()` and `getAchievementInstanceId()` in every mutation. New instances use the canonical shape:

```js
{
  achievementId: id,
  unlockedAt: now,
  source: "old_save_confirmed",
  hidden: false,
  displayable: true,
  spotlightAllowed: true,
}
```

Candidate generation must map only these strong signals:

```js
export function getOldSaveCandidateIds(answers = {}) {
  const signals = new Set();
  if (["undergraduate", "graduate"].includes(answers.educationStage)) {
    signals.add(`education_${answers.educationStage}`);
  }
  if (["working", "freelancing"].includes(answers.currentStage)) {
    signals.add(`stage_${answers.currentStage}`);
  }
  if (["recovered", "repeated_recovery"].includes(answers.setbackRecovery)) {
    signals.add(`setback_${answers.setbackRecovery}`);
  }

  return ACHIEVEMENT_CATALOG
    .filter((definition) => definition.oldSaveSignals.some((signal) => signals.has(signal)))
    .map((definition) => definition.id);
}
```

`completeOldSaveReview()` must select the lowest `rarityPercent` among confirmed, non-hidden, `spotlightAllowed !== false` records, write exactly one `representativeId`, and store the total confirmed count in `lastRecovery`.

- [ ] **Step 4: Integrate candidate creation into profile setup**

In `createInitialProfileSave()`, replace only the archive field after `createEmptySave()`:

```js
achievementArchive: {
  ...save.achievementArchive,
  scanStatus: "review",
  candidateIds: getOldSaveCandidateIds(importAnswers),
},
```

Keep current generic achievements such as `old_save_imported` for backward compatibility, but do not auto-award any of the 12 catalog achievements.

- [ ] **Step 5: Run focused and full tests**

Run: `node --test tests/core/achievements.test.mjs tests/core/profile.test.mjs`

Expected: all selected tests PASS.

Run: `npm.cmd test`

Expected: complete suite PASS.

- [ ] **Step 6: Commit the old-save rules**

```powershell
git add src/core/achievements.mjs src/core/profile.mjs tests/core/achievements.test.mjs tests/core/profile.test.mjs
git commit -m "feat: add old save achievement review rules"
```

### Task 4: Add Deterministic Day/Night Timing and Cancellable Scene Transitions

**Files:**
- Create: `src/core/night-transition.mjs`
- Create: `tests/core/night-transition.test.mjs`
- Modify: `src/scene/earth-scene.mjs`

- [ ] **Step 1: Write failing timing tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  getNightTransitionDuration,
  recordNightSwitch,
} from "../../src/core/night-transition.mjs";

test("transition duration is full once, then daily, then fast", () => {
  assert.equal(getNightTransitionDuration({}, "2026-07-11", false), 2400);
  assert.equal(getNightTransitionDuration({ firstNightEnteredAt: "2026-07-01", lastSwitchDate: "2026-07-10" }, "2026-07-11", false), 1300);
  assert.equal(getNightTransitionDuration({ firstNightEnteredAt: "2026-07-01", lastSwitchDate: "2026-07-11" }, "2026-07-11", false), 700);
  assert.equal(getNightTransitionDuration({}, "2026-07-11", true), 250);
});

test("recordNightSwitch resets the daily count without mutating input", () => {
  const archive = { firstNightEnteredAt: null, lastSwitchDate: null, switchCount: 0 };
  const next = recordNightSwitch(archive, "2026-07-11T08:00:00.000Z");
  assert.equal(next.firstNightEnteredAt, "2026-07-11T08:00:00.000Z");
  assert.equal(next.lastSwitchDate, "2026-07-11");
  assert.equal(next.switchCount, 1);
  assert.equal(archive.firstNightEnteredAt, null);
});
```

- [ ] **Step 2: Verify the test fails**

Run: `node --test tests/core/night-transition.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement timing and persistence helpers**

```js
export function getNightTransitionDuration(archive = {}, dateKey, reducedMotion = false) {
  if (reducedMotion) return 250;
  if (!archive.firstNightEnteredAt) return 2400;
  if (archive.lastSwitchDate !== dateKey) return 1300;
  return 700;
}

export function recordNightSwitch(archive = {}, now = new Date().toISOString()) {
  const dateKey = now.slice(0, 10);
  const sameDay = archive.lastSwitchDate === dateKey;
  return {
    ...archive,
    firstNightEnteredAt: archive.firstNightEnteredAt || now,
    lastSwitchDate: dateKey,
    switchCount: sameDay ? Number(archive.switchCount || 0) + 1 : 1,
  };
}
```

- [ ] **Step 4: Extend the scene API with a single visual tween owner**

Refactor `addLights(scene)` to return `{ sun, fill, oceanFill }`. Add `activeVisualTween`, `nightFactor`, and these public methods inside `createEarthScene()`:

```js
function toNight(duration = 1300) {
  idleRotation = false;
  return tweenVisualState(1, duration);
}

function toDay(duration = 700) {
  return tweenVisualState(0, duration).then(() => {
    idleRotation = false;
  });
}

function skipTransition() {
  if (!activeVisualTween) return;
  applyVisualState(activeVisualTween.target);
  const resolve = activeVisualTween.resolve;
  activeVisualTween = null;
  resolve();
}

function applyVisualState(factor) {
  nightFactor = factor;
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.2, 0.82, factor);
  lights.sun.intensity = THREE.MathUtils.lerp(2.65, 0.58, factor);
  lights.fill.intensity = THREE.MathUtils.lerp(1.18, 1.42, factor);
  lights.oceanFill.intensity = THREE.MathUtils.lerp(1.25, 0.5, factor);
  globe.globeMaterial().emissiveIntensity = THREE.MathUtils.lerp(0.3, 0.16, factor);
  atmosphere.material.opacity = THREE.MathUtils.lerp(0.29, 0.18, factor);
}
```

`tweenVisualState()` must cancel and resolve the previous visual tween before starting another, rotate `earthGroup.rotation.y` by no more than `Math.PI * 0.7`, update in the existing render loop, and restore a stable final state on completion. Return `{ start, focus, home, toNight, toDay, skipTransition }`.

- [ ] **Step 5: Run timing tests and syntax checks**

Run: `node --test tests/core/night-transition.test.mjs`

Expected: 2 tests PASS.

Run: `node --check src/scene/earth-scene.mjs`

Expected: exit code 0.

- [ ] **Step 6: Commit the transition engine**

```powershell
git add src/core/night-transition.mjs src/scene/earth-scene.mjs tests/core/night-transition.test.mjs
git commit -m "feat: add cancellable earth day night transition"
```

### Task 5: Generate and Validate the 12 GPT Image 2 Icons

**Files:**
- Create: `assets/achievements/academic-complete.png`
- Create: `assets/achievements/driver-license-hunter.png`
- Create: `assets/achievements/cooking-awakened.png`
- Create: `assets/achievements/first-love.png`
- Create: `assets/achievements/first-job.png`
- Create: `assets/achievements/overseas-checkin.png`
- Create: `assets/achievements/true-bond.png`
- Create: `assets/achievements/self-rescue.png`
- Create: `assets/achievements/keep-passion.png`
- Create: `assets/achievements/wilderness-camp.png`
- Create: `assets/achievements/financial-freedom.png`
- Create: `assets/achievements/paid-home.png`

- [ ] **Step 1: Invoke the installed imagegen skill and establish the master prompt**

Use this exact shared prompt prefix for every asset:

```text
Earth Online Night Archive achievement icon, square 1:1 composition, pure near-black background, one centered symbolic subject, refined metallic gold line art with consistent medium-fine stroke width, restrained archival engraving style, thin square gold frame, exactly two or three small four-point star accents, anonymous simplified human figure only when needed, 12 percent empty safe margin on every side, readable at 64 pixels, premium and quiet, no text, no letters, no numbers, no trophy, no game rarity badge, no neon, no gradient glow, no photorealism, no 3D render, no watermark.
```

- [ ] **Step 2: Generate each subject as a separate image**

Append one subject line per image:

```text
academic-complete: graduate lifting a diploma, mortarboard silhouette.
driver-license-hunter: driving license card, small car, steering permission seal.
cooking-awakened: home cook holding a spatula over a simple meal.
first-love: two nested heart paths forming one quiet pulse.
first-job: office worker holding the first signed work document.
overseas-checkin: traveler taking a photo between two recognizable but generic world landmarks.
true-bond: two friends supporting each other shoulder to shoulder.
self-rescue: solitary figure holding and relighting their own heart-shaped core.
keep-passion: person practicing one creative craft under a focused lamp.
wilderness-camp: one tent beneath a sparse night sky and mountain line.
financial-freedom: open hand releasing a restrained stack of resource tokens.
paid-home: simple house with an unlocked chain and completed ownership seal.
```

Generate one asset at a time so rejected compositions can be regenerated without changing the other 11.

- [ ] **Step 3: Validate every asset before adding it**

For each file, confirm:

- It is square and at least 1024 x 1024.
- It contains no text-like marks.
- The subject remains recognizable in a 64px preview.
- The gold hue and line weight match the other accepted icons.
- The frame and subject do not touch the 12% safe margin.

Use a local contact sheet for visual comparison, but do not ship the contact sheet.

- [ ] **Step 4: Commit only accepted assets**

```powershell
git add assets/achievements
git commit -m "assets: add first night archive icon set"
```

### Task 6: Build the Night Archive View and Rarity Styling

**Files:**
- Create: `src/ui/night-archive.mjs`
- Create: `src/styles/achievements.css`
- Create: `tests/ui/night-archive.test.mjs`
- Modify: `index.html`

- [ ] **Step 1: Write the failing view-model test**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildArchiveView } from "../../src/ui/night-archive.mjs";

test("archive view filters confirmed and hidden records without losing catalog order", () => {
  const save = {
    achievements: [
      { achievementId: "paid-home", hidden: true },
      { achievementId: "driver-license-hunter", hidden: false },
    ],
  };

  assert.deepEqual(buildArchiveView(save, "confirmed").map((item) => item.id), [
    "driver-license-hunter",
  ]);
  assert.deepEqual(buildArchiveView(save, "hidden").map((item) => item.id), [
    "paid-home",
  ]);
  assert.equal(buildArchiveView(save, "all").length, 12);
});
```

- [ ] **Step 2: Verify the missing-module failure**

Run: `node --test tests/ui/night-archive.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `buildArchiveView()` and the archive renderer**

Implement the pure merge with these exact semantics:

```js
export function buildArchiveView(save, filter = "all") {
  const instances = new Map(
    (Array.isArray(save?.achievements) ? save.achievements : [])
      .map((instance) => [getAchievementInstanceId(instance), instance])
      .filter(([id]) => id),
  );
  const items = ACHIEVEMENT_CATALOG.map((definition) => {
    const instance = instances.get(definition.id) || null;
    return {
      ...definition,
      instance,
      confirmed: Boolean(instance),
      hidden: Boolean(instance?.hidden),
      rarityTier: getRarityTier(definition.rarityPercent),
    };
  });

  if (filter === "confirmed") return items.filter((item) => item.confirmed && !item.hidden);
  if (filter === "unconfirmed") return items.filter((item) => !item.confirmed);
  if (filter === "hidden") return items.filter((item) => item.hidden);
  return items;
}
```

Implement the renderer around one archive shell. The exact event boundary is:

```js
export function renderNightArchive(root, options) {
  const {
    save,
    filter = "all",
    selectedId = null,
    onFilterChange,
    onSelect,
    onPresentationChange,
    onOpenReview,
    onReturnDay,
  } = options;
  const items = buildArchiveView(save, filter);
  const confirmedCount = buildArchiveView(save, "confirmed").length
    + buildArchiveView(save, "hidden").length;
  const panel = document.createElement("section");
  panel.className = "night-archive";
  panel.setAttribute("aria-label", "夜间档案馆");
  panel.innerHTML = renderArchiveShell({ items, filter, selectedId, confirmedCount });
  root.replaceChildren(panel);

  panel.querySelector("[data-action='return-day']")?.addEventListener("click", onReturnDay);
  panel.querySelector("[data-action='open-review']")?.addEventListener("click", onOpenReview);
  for (const button of panel.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => onFilterChange?.(button.dataset.filter));
  }
  for (const button of panel.querySelectorAll("[data-achievement-id]")) {
    button.addEventListener("click", () => onSelect?.(button.dataset.achievementId));
  }
  for (const input of panel.querySelectorAll("[data-presentation-field]")) {
    input.addEventListener("change", () => onPresentationChange?.(
      input.dataset.achievementId,
      { [input.dataset.presentationField]: input.checked },
    ));
  }
}
```

Keep HTML generation in local `renderArchiveShell()` and `escapeHtml()` helpers so controller code never constructs archive markup.

`buildArchiveView()` must merge the 12 definitions with save instances through `getAchievementInstanceId()`, attach `getRarityTier()`, and implement exactly these filters: `all`, `confirmed`, `unconfirmed`, `hidden`.

The renderer must contain:

- A shared Earth Online top bar with a sun icon button labeled `返回清晨系统`.
- Archive title and `已收录 X / 12` count.
- Four filter buttons using `aria-pressed`.
- A long-card list, not a marketing card grid.
- A details pane or modal with presentation toggles.
- One information button explaining fixed estimated record rates.
- A `补录旧存档` command that opens review mode.

- [ ] **Step 4: Add the approved visual system**

In `src/styles/achievements.css`, define a deep-blue outer shell and near-black achievement content. Use tier classes:

```css
.achievement-card[data-rarity="common"] { --metal: #b89555; --signal: 0; }
.achievement-card[data-rarity="precious"] { --metal: #d8b65f; --signal: 0; }
.achievement-card[data-rarity="rare"] { --metal: #eadca7; --signal: 0.35; }
.achievement-card[data-rarity="ultra_rare"] { --metal: #eee8d4; --signal: 0.58; }
.achievement-card[data-rarity="world_record"] { --metal: #f5f0d8; --signal: 0.8; }
```

Only `rare`, `ultra_rare`, and `world_record` may animate. Respect `prefers-reduced-motion: reduce`. Keep card radius at 8px or less, avoid nested cards, and maintain stable icon dimensions with `aspect-ratio: 1`.

Link the stylesheet after `styles.css`:

```html
<link rel="stylesheet" href="./src/styles.css" />
<link rel="stylesheet" href="./src/styles/achievements.css" />
```

- [ ] **Step 5: Run tests and syntax checks**

Run: `node --test tests/ui/night-archive.test.mjs`

Expected: selected test PASS.

Run: `node --check src/ui/night-archive.mjs`

Expected: exit code 0.

- [ ] **Step 6: Commit the archive browsing slice**

```powershell
git add index.html src/ui/night-archive.mjs src/styles/achievements.css tests/ui/night-archive.test.mjs
git commit -m "feat: add responsive night archive browser"
```

### Task 7: Build the Old-Save Review and Single-Spotlight Recovery Flow

**Files:**
- Create: `src/ui/old-save-review.mjs`
- Modify: `src/styles/achievements.css`
- Modify: `tests/core/achievements.test.mjs`

- [ ] **Step 1: Add a failing review-summary test**

```js
test("recovery summary reports one representative and the remaining archive count", () => {
  let save = { achievements: [], achievementArchive: createEmptyAchievementArchive() };
  save = confirmOldSaveAchievement(save, "academic-complete");
  save = confirmOldSaveAchievement(save, "first-job");
  save = confirmOldSaveAchievement(save, "self-rescue");
  const completed = completeOldSaveReview(save, "2026-07-11T04:00:00.000Z");

  assert.equal(completed.achievementArchive.lastRecovery.count, 3);
  assert.ok(completed.achievementArchive.lastRecovery.representativeId);
  assert.equal(completed.achievementArchive.lastRecovery.remainingCount, 2);
});
```

- [ ] **Step 2: Run the test and verify it fails on `remainingCount`**

Run: `node --test tests/core/achievements.test.mjs`

Expected: FAIL because `remainingCount` is not yet stored.

- [ ] **Step 3: Store the exact recovery summary**

Update `completeOldSaveReview()` so `lastRecovery` is:

```js
{
  at: now,
  count: confirmed.length,
  representativeId: representative?.achievementId || null,
  remainingCount: Math.max(0, confirmed.length - (representative ? 1 : 0)),
}
```

- [ ] **Step 4: Implement the review renderer**

Implement one renderer with callbacks that only emit IDs and never mutate save state directly:

```js
export function renderOldSaveReview(root, options) {
  const {
    save,
    onConfirm,
    onDismiss,
    onRestoreDismissed,
    onComplete,
    onReturnArchive,
  } = options;
  const archive = normalizeAchievementArchive(save?.achievementArchive);
  const candidateSet = new Set(archive.candidateIds);
  const confirmedSet = new Set(
    (save?.achievements || []).map(getAchievementInstanceId).filter(Boolean),
  );
  const groups = groupDefinitionsByCategory(ACHIEVEMENT_CATALOG);
  const panel = document.createElement("section");
  panel.className = "old-save-review";
  panel.setAttribute("aria-label", "旧存档记录确认");
  panel.innerHTML = renderReviewShell({ groups, archive, candidateSet, confirmedSet });
  root.replaceChildren(panel);

  panel.querySelector("[data-action='return-archive']")?.addEventListener("click", onReturnArchive);
  panel.querySelector("[data-action='complete-review']")?.addEventListener("click", onComplete);
  for (const button of panel.querySelectorAll("[data-review-action]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.achievementId;
      const action = button.dataset.reviewAction;
      if (action === "confirm") onConfirm?.(id);
      if (action === "dismiss") onDismiss?.(id);
      if (action === "restore") onRestoreDismissed?.(id);
    });
  }
}
```

Keep `groupDefinitionsByCategory()` and `renderReviewShell()` local to this file. Render the candidate group first, then the complete catalog under `补录未发现记录`.

Required behavior:

- Start with strong-signal candidates.
- Group the full 12-item catalog by life chapter below `补录未发现记录`.
- Provide `确认收录` and `暂不收录` per item.
- Never label or auto-hide relationship, money, family, or health records.
- Keep presentation controls in details, not on every compact row.
- On complete, show one representative achievement ceremony and one stack summary: `旧存档已恢复，新增 N 项人生记录`.
- The ceremony must have a skip button and return focus to the archive after closing.

- [ ] **Step 5: Add review and ceremony styles**

Use the same deep-blue shell and black-gold card system. The batch stack is a single layered archive visual, not multiple card animations. On mobile, place the primary action at the bottom without covering list content.

- [ ] **Step 6: Run focused tests and syntax checks**

Run: `node --test tests/core/achievements.test.mjs`

Expected: all achievement tests PASS.

Run: `node --check src/ui/old-save-review.mjs`

Expected: exit code 0.

- [ ] **Step 7: Commit the review flow**

```powershell
git add src/core/achievements.mjs src/ui/old-save-review.mjs src/styles/achievements.css tests/core/achievements.test.mjs
git commit -m "feat: add old save review and recovery ceremony"
```

### Task 8: Integrate Day/Night Modes in the App Controller

**Files:**
- Modify: `src/ui/system-panel.mjs`
- Modify: `src/app/controller.mjs`
- Modify: `src/styles.css`
- Modify: `tests/ui/system-panel.test.mjs`

- [ ] **Step 1: Add a failing system-panel entry-state test**

Add a pure exported helper in the test first:

```js
import { getArchiveEntryState } from "../../src/ui/system-panel.mjs";

test("archive entry announces pending old-save review", () => {
  assert.deepEqual(getArchiveEntryState({
    achievementArchive: { scanStatus: "review", candidateIds: ["academic-complete"] },
    achievements: [],
  }), {
    label: "进入夜间档案馆",
    badge: "1 条待确认",
  });
});
```

- [ ] **Step 2: Verify the helper test fails**

Run: `node --test tests/ui/system-panel.test.mjs`

Expected: FAIL because `getArchiveEntryState` is not exported.

- [ ] **Step 3: Add the moon-phase entry to the morning top bar**

Extend `renderSystemPanel()` options with `onOpenArchive`. Add a compact icon button before the exit control:

```html
<button class="archive-entry" type="button" aria-label="进入夜间档案馆" title="夜间档案馆">
  <span aria-hidden="true">◐</span>
  <small>${escapeHtml(archiveEntry.badge)}</small>
</button>
```

Bind it to `onOpenArchive?.()`. Keep the task area unchanged and prevent the badge from resizing the top bar.

- [ ] **Step 4: Add guarded controller modes and error recovery**

Import the new renderers and transition helpers. Extend state with `archiveFilter`, `archiveSelectedId`, and `transitionId`. Implement these controller functions:

```js
async function openArchive() {
  if (state.mode !== "panel") return;
  const transitionId = ++state.transitionId;
  state.mode = "transitioning-night";
  const dateKey = new Date().toISOString().slice(0, 10);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const duration = getNightTransitionDuration(state.save.achievementArchive, dateKey, reduced);

  try {
    dom.systemRoot.classList.add("is-transitioning-night");
    await state.scene.toNight(duration);
    if (transitionId !== state.transitionId) return;
    state.save = saveLocalSave({
      ...state.save,
      achievementArchive: recordNightSwitch(state.save.achievementArchive),
    });
    showArchiveOrReview();
  } catch (error) {
    if (transitionId !== state.transitionId) return;
    state.mode = "panel";
    dom.systemRoot.classList.remove("is-transitioning-night");
    state.scene.toDay(250);
    showPanel({ persistGeneratedTasks: false });
  }
}
```

Add a symmetrical `returnToDay()` and a shared `skipActiveTransition()` that calls `scene.skipTransition()`. `Escape` during a transition skips it; `Escape` in archive returns to day; `Escape` in the morning panel returns home.

Pass a controller wrapper to both the moon and sun controls so a repeated click skips instead of starting another transition:

```js
function handleDayNightControl() {
  if (state.mode === "transitioning-night" || state.mode === "transitioning-day") {
    state.scene.skipTransition();
    return;
  }
  if (state.mode === "panel") openArchive();
  if (state.mode === "archive" || state.mode === "archive-review") returnToDay();
}
```

`showArchiveOrReview()` renders review when `scanStatus !== "complete"`, otherwise renders the archive. Save every confirm, dismiss, revoke, and presentation change through `saveLocalSave()` before rerendering.

- [ ] **Step 5: Add transition shell styles**

Use opacity, blur, and transform only for the DOM shell while Three.js performs the real day/night change. Add a stable full-viewport decorative transition layer with `pointer-events: none`, but keep the existing moon or sun control clickable so it can skip; never leave the layer visible after resolve or rejection.

- [ ] **Step 6: Run unit and syntax checks**

Run: `node --test tests/ui/system-panel.test.mjs`

Expected: all system-panel tests PASS.

Run: `node --check src/app/controller.mjs; node --check src/ui/system-panel.mjs`

Expected: exit code 0.

- [ ] **Step 7: Commit the integrated mode switch**

```powershell
git add src/app/controller.mjs src/ui/system-panel.mjs src/styles.css tests/ui/system-panel.test.mjs
git commit -m "feat: connect morning panel to night archive"
```

### Task 9: Add Sequential Runtime Achievement Notifications

**Files:**
- Create: `src/ui/achievement-toast.mjs`
- Create: `tests/ui/achievement-toast.test.mjs`
- Modify: `src/core/progression.mjs`
- Modify: `tests/core/progression.test.mjs`
- Modify: `src/app/controller.mjs`
- Modify: `src/styles/achievements.css`

- [ ] **Step 1: Write failing delta and queue tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  createAchievementToastQueue,
  getNewAchievementIds,
} from "../../src/ui/achievement-toast.mjs";

test("achievement delta accepts canonical and legacy IDs", () => {
  assert.deepEqual(getNewAchievementIds(
    [{ id: "old" }],
    [{ id: "old" }, { achievementId: "new" }],
  ), ["new"]);
});

test("toast queue displays one record at a time", async () => {
  const shown = [];
  const queue = createAchievementToastQueue({
    show: async (id) => shown.push(id),
  });
  await Promise.all([queue.enqueue("a"), queue.enqueue("b")]);
  assert.deepEqual(shown, ["a", "b"]);
});
```

- [ ] **Step 2: Verify tests fail**

Run: `node --test tests/ui/achievement-toast.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement delta detection and a promise-chain queue**

```js
export function getNewAchievementIds(previous = [], next = []) {
  const known = new Set(previous.map(getAchievementInstanceId).filter(Boolean));
  return next.map(getAchievementInstanceId).filter((id) => id && !known.has(id));
}

export function createAchievementToastQueue({ show }) {
  let tail = Promise.resolve();
  return {
    enqueue(id) {
      tail = tail.then(() => show(id));
      return tail;
    },
  };
}
```

The browser `show()` implementation creates one `.achievement-toast`, waits 3.5 seconds, removes it, then resolves. Provide an explicit close button. Unknown runtime IDs use a neutral gold archive glyph and the instance label.

- [ ] **Step 4: Move new runtime unlocks to canonical instances**

Update `unlockRuntimeAchievements()` to write:

```js
{
  achievementId: "npc_filter",
  label: "拒绝无效消耗",
  rarityPercent: getRarity("npc_filter", 4.0, 12.0),
  source: "runtime",
  unlockedAt: now,
  hidden: false,
  displayable: true,
  spotlightAllowed: true,
}
```

Use `getAchievementInstanceId()` for duplicate detection so old `id: "npc_filter"` records still suppress duplicate rewards. Update the progression tests to assert the canonical fields and legacy duplicate compatibility.

- [ ] **Step 5: Integrate the queue at the controller save boundary**

Before replacing `state.save`, compare old and new achievement arrays. Enqueue each new ID after persistence. Do not enqueue old-save batch confirmations; the review ceremony owns those.

- [ ] **Step 6: Add toast styles and run tests**

Keep the desktop toast at the lower right and the mobile toast above the safe-area inset. Do not cover daily task buttons. Disable entrance motion under reduced-motion preferences.

Run: `node --test tests/ui/achievement-toast.test.mjs tests/core/progression.test.mjs`

Expected: all selected tests PASS.

Run: `npm.cmd test`

Expected: complete suite PASS.

- [ ] **Step 7: Commit notifications**

```powershell
git add src/ui/achievement-toast.mjs src/core/progression.mjs src/app/controller.mjs src/styles/achievements.css tests/ui/achievement-toast.test.mjs tests/core/progression.test.mjs
git commit -m "feat: add queued achievement unlock notices"
```

### Task 10: Complete Browser QA, Accessibility, and Regression Verification

**Files:**
- Modify only files that fail the checks below.
- Update: `docs/superpowers/specs/2026-07-11-achievement-system-v0.2-design.md` only if an approved behavior must be clarified.

- [ ] **Step 1: Run all automated verification**

Run:

```powershell
npm.cmd test
node --check src/app/controller.mjs
node --check src/scene/earth-scene.mjs
node --check src/ui/night-archive.mjs
node --check src/ui/old-save-review.mjs
node --check src/ui/achievement-toast.mjs
git diff --check
```

Expected: all tests PASS, all syntax checks exit 0, and `git diff --check` prints nothing.

- [ ] **Step 2: Start the local server**

Run: `npm.cmd start`

Expected: the server reports a localhost URL and remains running for browser QA.

- [ ] **Step 3: Verify the complete desktop path at 1280 x 720**

In the in-app browser:

1. Open the morning panel.
2. Confirm the moon entry does not displace daily tasks.
3. Enter Night Archive and capture the first 2.4-second transition.
4. Confirm the canvas is nonblank before, during, and after transition using screenshots and canvas pixel inspection.
5. Confirm one representative recovery ceremony and one batch summary.
6. Confirm all 12 long cards render with real icons and visible rarity differences.
7. Confirm filters, detail toggles, dismiss, revoke, and return-to-day behavior.
8. Confirm the next switch is faster and no duplicate panel exists.

- [ ] **Step 4: Verify mobile behavior at 390 x 844**

Check:

- No horizontal overflow.
- Filter controls remain usable without a horizontal card carousel.
- Card titles, rates, and action buttons do not overlap.
- The detail surface fits the viewport and scrolls internally when needed.
- The toast stays above safe-area and primary controls.
- The day/night button remains reachable with one hand.

- [ ] **Step 5: Verify reduced motion and transition cancellation**

Enable reduced-motion emulation and confirm the transition finishes in about 250ms with no spinning or long camera movement. During a normal transition, click again and press Escape; both paths must settle in a valid day or night mode without a black overlay.

- [ ] **Step 6: Verify save integrity**

Export a save containing confirmed, hidden, dismissed, and unknown legacy achievements. Re-import it and confirm every record and privacy flag survives. Import malformed JSON and confirm the current save remains unchanged.

- [ ] **Step 7: Commit QA fixes as a focused final slice**

```powershell
git add src/app/controller.mjs src/core/achievements.mjs src/core/night-transition.mjs src/scene/earth-scene.mjs src/ui/achievement-toast.mjs src/ui/night-archive.mjs src/ui/old-save-review.mjs src/ui/system-panel.mjs src/styles.css src/styles/achievements.css
git commit -m "fix: complete night archive visual qa"
```

Omit this commit when QA produces no code changes.

- [ ] **Step 8: Record final evidence**

Report:

- Total test count and pass count.
- Desktop and mobile viewport results.
- Reduced-motion and cancellation results.
- Save round-trip result.
- Any intentionally deferred item from section 13 of the approved spec.
