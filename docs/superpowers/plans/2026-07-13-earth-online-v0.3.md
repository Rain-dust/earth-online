# Earth Online v0.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Earth Online 升级为只包含一条主线、一项维护和一条自由记录的本地人生运行系统，并在夜间档案中沉淀运行成就与个人轨迹。

**Architecture:** 保留现有无框架 ES Modules 与纯前端控制器，将主线、每日运行、维护选取、事件日志、周归档、成就规则和快照存储拆成可单测的纯核心模块。`localStorage` 继续保存活跃存档，IndexedDB 只保存滚动快照；清晨面板与夜间档案通过已有 App Controller 和 3D 地球昼夜过渡连接。

**Tech Stack:** JavaScript ES Modules, Node.js `node:test`, HTML/CSS, Three.js, Lucide icons, IndexedDB, GPT Image 2, local Node HTTP server.

**Design:** `docs/superpowers/specs/2026-07-13-earth-online-v0.3-design.md`

---

## File Map

### Core modules

- Create `src/core/local-date.mjs`: device-local date keys and Monday-to-Sunday week boundaries.
- Create `src/core/activity-log.mjs`: idempotent append-only activity events.
- Create `src/core/main-quest.mjs`: the single-active-quest invariant and quest lifecycle.
- Create `src/core/maintenance.mjs`: status-based maintenance selection, replacement, exclusions, and custom items.
- Create `src/core/daily-run.mjs`: the three daily slots and formal synchronization rules.
- Create `src/core/weekly-archive.mjs`: idempotent weekly aggregation and optional weekly note.
- Create `src/core/runtime-achievements.mjs`: the six v0.3 runtime achievement rules.
- Create `src/core/snapshot-store.mjs`: IndexedDB snapshots and retention.
- Modify `src/core/storage.mjs`: schema v2 migration, validation, and new defaults.
- Modify `src/core/progression.mjs`: reward-ledger idempotency; keep the existing level curve.
- Modify `src/core/constants.mjs`: five statuses and maintenance catalog.
- Modify `src/core/achievement-catalog.mjs`: compose life and runtime catalogs without changing life IDs.

### UI modules

- Create `src/ui/status-control.mjs`: Lucide-backed compact status selector.
- Create `src/ui/main-quest-dialog.mjs`: focused main-quest create/manage overlay.
- Create `src/ui/personal-timeline.mjs`: weekly orbital timeline renderer.
- Create `src/ui/save-recovery.mjs`: snapshot list and restore confirmation.
- Modify `src/ui/system-panel.mjs`: new morning hierarchy and three action slots.
- Modify `src/ui/night-archive.mjs`: life/runtime/timeline views.
- Modify `src/app/controller.mjs`: persistence, snapshot hooks, and new UI callbacks.
- Modify `src/styles.css`: morning panel, status selector, quest overlay, and save recovery.
- Modify `src/styles/achievements.css`: runtime silver cards and orbital timeline.
- Modify `index.html`: local Lucide runtime script.

### Assets and references

- Create `assets/achievements/runtime/route-online.png`.
- Create `assets/achievements/runtime/mission-complete.png`.
- Create the remaining four runtime crest assets only after the two-sample visual checkpoint passes.
- Modify `OPEN_SOURCE_REFERENCES.md`: Lucide source/license and runtime crest generation note.

### Tests

- Create one focused core test file for each new core module.
- Create `tests/ui/status-control.test.mjs`, `tests/ui/main-quest-dialog.test.mjs`, `tests/ui/personal-timeline.test.mjs`, and `tests/ui/save-recovery.test.mjs`.
- Modify the current storage, progression, system-panel, night-archive, achievement-catalog, achievement-toast, and controller-facing UI tests.

---

### Task 1: Add local calendar semantics and schema-v2 migration

**Files:**
- Create: `src/core/local-date.mjs`
- Modify: `src/core/storage.mjs`
- Create: `tests/core/local-date.test.mjs`
- Modify: `tests/core/storage.test.mjs`

- [ ] **Step 1: Write failing local-date tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  getLocalDateKey,
  getLocalWeekRange,
} from "../../src/core/local-date.mjs";

test("getLocalDateKey uses calendar fields instead of UTC slicing", () => {
  const local = new Date(2026, 6, 13, 23, 58, 0);
  assert.equal(getLocalDateKey(local), "2026-07-13");
});

test("getLocalWeekRange returns Monday through Sunday", () => {
  const thursday = new Date(2026, 6, 16, 12, 0, 0);
  assert.deepEqual(getLocalWeekRange(thursday), {
    key: "2026-07-13",
    start: "2026-07-13",
    end: "2026-07-19",
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `node --test tests/core/local-date.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/core/local-date.mjs`.

- [ ] **Step 3: Implement local calendar helpers**

```js
export function getLocalDateKey(value = new Date()) {
  const date = normalizeDate(value);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function getLocalWeekRange(value = new Date()) {
  const date = normalizeDate(value);
  const day = date.getDay() || 7;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - day + 1);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return {
    key: getLocalDateKey(start),
    start: getLocalDateKey(start),
    end: getLocalDateKey(end),
  };
}

function normalizeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError("Invalid calendar date");
  return date;
}
```

- [ ] **Step 4: Write failing storage migration tests**

Add assertions that `createEmptySave()` has `schemaVersion: 2`, empty `mainQuestArchive`, `dailyRuns`, `activityEvents`, `rewardLedger`, `weeklyArchive`, and `maintenancePreferences`. Add this migration case:

```js
test("importSave migrates a v0.2 main quest without losing legacy data", () => {
  const legacy = createEmptySave("2026-07-12T23:00:00.000Z");
  delete legacy.schemaVersion;
  legacy.mainQuest = { title: "完成 Earth Online", nextStep: "整理 v0.3 规格" };
  legacy.dailyTasks = [{ id: "legacy-task", date: "2026-07-12" }];

  const imported = importSave(JSON.stringify(legacy));

  assert.equal(imported.schemaVersion, 2);
  assert.equal(imported.mainQuest.id, "legacy-main-quest");
  assert.equal(imported.mainQuest.status, "active");
  assert.equal(imported.mainQuest.currentAction.text, "整理 v0.3 规格");
  assert.deepEqual(imported.dailyTasks, legacy.dailyTasks);
});
```

- [ ] **Step 5: Implement schema-v2 defaults and migration**

Keep `SAVE_FORMAT` and `STORAGE_KEY` at v1. Add `SCHEMA_VERSION = 2`, normalize the new arrays and preferences, and migrate legacy `mainQuest` using this shape:

```js
function migrateMainQuest(value, exportedAt) {
  if (!value) return null;
  const title = typeof value === "string" ? value.trim() : String(value.title || "").trim();
  if (!title) return null;
  const action = typeof value === "object"
    ? String(value.currentAction?.text || value.nextStep || title).trim()
    : title;
  return {
    id: value.id || "legacy-main-quest",
    title,
    status: "active",
    startedAt: value.startedAt || exportedAt,
    currentAction: {
      id: value.currentAction?.id || "legacy-main-action",
      text: action,
      createdAt: value.currentAction?.createdAt || exportedAt,
    },
  };
}
```

- [ ] **Step 6: Run storage and calendar tests**

Run: `node --test tests/core/local-date.test.mjs tests/core/storage.test.mjs`  
Expected: all tests PASS; existing v1 format and unknown-field preservation tests still pass.

- [ ] **Step 7: Commit the migration boundary**

```bash
git add src/core/local-date.mjs src/core/storage.mjs tests/core/local-date.test.mjs tests/core/storage.test.mjs
git commit -m "feat: migrate saves for daily runtime"
```

### Task 2: Add idempotent activity events and reward ledger

**Files:**
- Create: `src/core/activity-log.mjs`
- Modify: `src/core/progression.mjs`
- Create: `tests/core/activity-log.test.mjs`
- Modify: `tests/core/progression.test.mjs`

- [ ] **Step 1: Write failing activity-log tests**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { appendActivityEvent } from "../../src/core/activity-log.mjs";

test("appendActivityEvent stores one immutable event per id", () => {
  const save = { activityEvents: [] };
  const event = {
    id: "2026-07-13:main",
    type: "main_action_synced",
    localDate: "2026-07-13",
    at: "2026-07-13T08:00:00.000Z",
    questId: "quest-1",
    payload: { text: "完成数据迁移" },
  };
  const first = appendActivityEvent(save, event);
  const second = appendActivityEvent(first, { ...event, payload: { text: "重复点击" } });
  assert.equal(first.activityEvents.length, 1);
  assert.equal(second.activityEvents.length, 1);
  assert.equal(second.activityEvents[0].payload.text, "完成数据迁移");
});
```

- [ ] **Step 2: Write failing reward-ledger tests**

```js
test("grantDailyExp grants each daily slot once", () => {
  const save = {
    level: { value: 1, exp: 0, nextLevelExp: 16, progress: 0 },
    rewardLedger: [],
  };
  const first = grantDailyExp(save, {
    key: "2026-07-13:main",
    type: "main",
    exp: 20,
    at: "2026-07-13T08:00:00.000Z",
  });
  const second = grantDailyExp(first, {
    key: "2026-07-13:main",
    type: "main",
    exp: 20,
    at: "2026-07-13T08:01:00.000Z",
  });
  assert.equal(first.level.exp, 20);
  assert.equal(second.level.exp, 20);
  assert.equal(second.rewardLedger.length, 1);
});
```

- [ ] **Step 3: Run focused tests and verify missing exports**

Run: `node --test tests/core/activity-log.test.mjs tests/core/progression.test.mjs`  
Expected: FAIL because `appendActivityEvent` and `grantDailyExp` do not exist.

- [ ] **Step 4: Implement idempotent append and rewards**

```js
export function appendActivityEvent(save, event) {
  const events = Array.isArray(save?.activityEvents) ? save.activityEvents : [];
  if (!event?.id || events.some((item) => item?.id === event.id)) return save;
  return { ...save, activityEvents: [...events, structuredClone(event)] };
}
```

In `progression.mjs`, retain `applyExp()` and add:

```js
export function grantDailyExp(save, reward) {
  const ledger = Array.isArray(save?.rewardLedger) ? save.rewardLedger : [];
  if (!reward?.key || ledger.some((entry) => entry?.key === reward.key)) return save;
  const entry = {
    key: reward.key,
    type: reward.type,
    exp: Math.max(0, Math.round(Number(reward.exp) || 0)),
    at: reward.at,
  };
  return {
    ...save,
    rewardLedger: [...ledger, entry],
    level: applyExp(save?.level, entry.exp),
  };
}
```

- [ ] **Step 5: Run focused and full core tests**

Run: `node --test tests/core/activity-log.test.mjs tests/core/progression.test.mjs tests/core/storage.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 6: Commit the event and reward foundation**

```bash
git add src/core/activity-log.mjs src/core/progression.mjs tests/core/activity-log.test.mjs tests/core/progression.test.mjs
git commit -m "feat: add idempotent runtime ledger"
```

### Task 3: Implement the single active main quest lifecycle

**Files:**
- Create: `src/core/main-quest.mjs`
- Create: `tests/core/main-quest.test.mjs`

- [ ] **Step 1: Write failing lifecycle tests**

Cover create, pause, switch, resume, abandon, and complete. The central invariant test is:

```js
test("switchMainQuest archives the current quest and activates exactly one new quest", () => {
  const first = createMainQuest({ mainQuest: null, mainQuestArchive: [] }, {
    title: "完成 Earth Online v0.3",
    firstAction: "完成数据迁移",
  }, "2026-07-13T08:00:00.000Z");
  const second = switchMainQuest(first, {
    title: "准备作品集",
    firstAction: "选择三个作品",
  }, "2026-07-13T09:00:00.000Z");

  assert.equal(second.mainQuest.title, "准备作品集");
  assert.equal(second.mainQuest.status, "active");
  assert.equal(second.mainQuestArchive.length, 1);
  assert.equal(second.mainQuestArchive[0].status, "paused");
});
```

Also assert `completeMainQuest` appends one `quest_completed` event and repeated completion returns the same save reference.

- [ ] **Step 2: Run the test and verify the missing module failure**

Run: `node --test tests/core/main-quest.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement validation and quest creation**

```js
export function createMainQuest(save, input, now = new Date().toISOString()) {
  const title = String(input?.title || "").trim();
  const text = String(input?.firstAction || "").trim();
  if (!title || !text) throw new Error("主线与第一步不能为空");
  if (save?.mainQuest?.status === "active") throw new Error("已存在活跃主线");
  const id = `quest-${crypto.randomUUID()}`;
  return {
    ...save,
    mainQuest: {
      id,
      title,
      status: "active",
      startedAt: now,
      currentAction: {
        id: `action-${crypto.randomUUID()}`,
        text,
        createdAt: now,
      },
    },
  };
}
```

Inject an `idFactory` option in tests rather than monkey-patching `crypto.randomUUID`, so test IDs remain deterministic.

- [ ] **Step 4: Implement pause, switch, resume, abandon, and complete**

Use one internal `archiveActiveQuest(save, status, now)` helper. Every transition copies the quest into `mainQuestArchive` with `updatedAt`; completion also sets `completedAt` and appends this event:

```js
{
  id: `quest-completed:${quest.id}`,
  type: "quest_completed",
  localDate: getLocalDateKey(new Date(now)),
  at: now,
  questId: quest.id,
  payload: { title: quest.title },
}
```

- [ ] **Step 5: Run the main-quest tests**

Run: `node --test tests/core/main-quest.test.mjs`  
Expected: all lifecycle and idempotency tests PASS.

- [ ] **Step 6: Commit main-quest behavior**

```bash
git add src/core/main-quest.mjs tests/core/main-quest.test.mjs
git commit -m "feat: add single main quest lifecycle"
```

### Task 4: Build maintenance selection and the three-slot daily run

**Files:**
- Modify: `src/core/constants.mjs`
- Create: `src/core/maintenance.mjs`
- Create: `src/core/daily-run.mjs`
- Create: `tests/core/maintenance.test.mjs`
- Create: `tests/core/daily-run.test.mjs`
- Modify: `tests/core/tasks.test.mjs`

- [ ] **Step 1: Replace the six-status expectations with five-status tests**

Assert that `maintenance_mode` no longer appears, all five labels exist, and each status has at least four concrete maintenance candidates. Every candidate must have a non-empty title and `maxMinutes <= 20`.

- [ ] **Step 2: Write failing maintenance selection tests**

```js
test("selectMaintenance avoids the previous three dates and excluded items", () => {
  const selected = selectMaintenance({
    date: "2026-07-13",
    status: "stable_operation",
    recentRuns: [
      { date: "2026-07-12", maintenance: { itemId: "drink-water" } },
      { date: "2026-07-11", maintenance: { itemId: "stretch-five" } },
      { date: "2026-07-10", maintenance: { itemId: "clear-visible-item" } },
    ],
    preferences: { excludedIds: ["reply-important-message"], customItems: [] },
  });
  assert.equal([
    "drink-water",
    "stretch-five",
    "clear-visible-item",
    "reply-important-message",
  ].includes(selected.itemId), false);
});
```

Also test one replacement per day, same-day exclusion of the replaced item, and fallback when the pool is exhausted.

- [ ] **Step 3: Write failing daily-run tests**

```js
test("ensureDailyRun creates exactly three semantic slots", () => {
  const save = fixtureSaveWithMainQuest();
  const next = ensureDailyRun(save, "2026-07-13");
  const run = next.dailyRuns[0];
  assert.equal(run.mainAction.text, "完成数据迁移");
  assert.ok(run.maintenance.itemId);
  assert.equal(run.freeRecord, null);
});

test("formal main sync rewards once while extra progress remains recordable", () => {
  const save = ensureDailyRun(fixtureSaveWithMainQuest(), "2026-07-13");
  const first = syncMainAction(save, "2026-07-13", "2026-07-13T08:00:00.000Z");
  const repeated = syncMainAction(first, "2026-07-13", "2026-07-13T08:01:00.000Z");
  const extra = recordAdditionalMainProgress(repeated, "2026-07-13", "完成额外回归", "2026-07-13T09:00:00.000Z");
  assert.equal(extra.level.exp, 20);
  assert.equal(extra.activityEvents.filter((event) => event.type === "main_action_synced").length, 1);
  assert.equal(extra.activityEvents.filter((event) => event.type === "main_progress_added").length, 1);
});
```

- [ ] **Step 4: Run focused tests and verify failures**

Run: `node --test tests/core/maintenance.test.mjs tests/core/daily-run.test.mjs tests/core/tasks.test.mjs`  
Expected: FAIL because the new modules and five-status constants do not exist.

- [ ] **Step 5: Implement maintenance selection**

Use a deterministic hash of `date + status` to choose among eligible candidates so refreshing does not change the task. The selector must return this stable shape:

```js
{
  itemId: "stretch-five",
  title: "伸展 5 分钟",
  status: "stable_operation",
  source: "system",
  maxMinutes: 5,
  replaced: false,
  completedAt: null,
}
```

- [ ] **Step 6: Implement daily-run synchronization**

`ensureDailyRun`, `syncMainAction`, `syncMaintenance`, and `saveFreeRecord` must update `dailyRuns`, append activity events, and call `grantDailyExp` with these keys and values:

```js
const DAILY_REWARDS = Object.freeze({
  main: { suffix: "main", exp: 20 },
  maintenance: { suffix: "maintenance", exp: 8 },
  freeRecord: { suffix: "free-record", exp: 8 },
});
```

Editing or deleting a free record changes the record and event payload but never removes or recreates its reward ledger entry.

- [ ] **Step 7: Run focused tests and remove obsolete generic-task assertions**

Run: `node --test tests/core/maintenance.test.mjs tests/core/daily-run.test.mjs tests/core/tasks.test.mjs tests/core/progression.test.mjs`  
Expected: all tests PASS; old localization/migration utilities may remain, but new days no longer generate five generic tasks.

- [ ] **Step 8: Commit the daily runtime core**

```bash
git add src/core/constants.mjs src/core/maintenance.mjs src/core/daily-run.mjs tests/core/maintenance.test.mjs tests/core/daily-run.test.mjs tests/core/tasks.test.mjs
git commit -m "feat: reduce daily runtime to three actions"
```

### Task 5: Redesign the morning panel and status control

**Files:**
- Modify: `package.json`
- Create: `package-lock.json`
- Modify: `index.html`
- Create: `src/ui/status-control.mjs`
- Create: `src/ui/main-quest-dialog.mjs`
- Modify: `src/ui/system-panel.mjs`
- Modify: `src/app/controller.mjs`
- Modify: `src/styles.css`
- Create: `tests/ui/status-control.test.mjs`
- Create: `tests/ui/main-quest-dialog.test.mjs`
- Modify: `tests/ui/system-panel.test.mjs`

- [ ] **Step 1: Add the locked Lucide dependency**

Run: `npm install lucide@0.468.0 --save-exact`  
Expected: `package.json` and `package-lock.json` record exactly `0.468.0`.

Add the local script before `src/main.js`:

```html
<script src="./node_modules/lucide/dist/umd/lucide.min.js"></script>
<script type="module" src="./src/main.js"></script>
```

- [ ] **Step 2: Write failing status-control tests**

```js
test("getStatusOptions exposes five recognizable vector icons", () => {
  assert.deepEqual(getStatusOptions().map(({ id, icon }) => [id, icon]), [
    ["stable_operation", "orbit"],
    ["high_load", "gauge"],
    ["low_energy", "battery-low"],
    ["lost_route", "compass"],
    ["main_quest_push", "route"],
  ]);
});
```

Render tests must assert a button with `aria-haspopup="listbox"`, five options, `aria-selected`, and visible Chinese labels.

- [ ] **Step 3: Write failing main-quest dialog tests**

Test the empty state with exactly two fields (`title`, `firstAction`) and the active state with only `currentAction`, pause, complete, and switch controls. Assert that deadline, priority, estimate, and success-standard inputs are absent.

- [ ] **Step 4: Rewrite system-panel behavior tests around the three slots**

Replace the old five-task and streak-oriented assertions with:

```js
test("buildMorningView makes the main action primary and exposes three slots", () => {
  const view = buildMorningView(fixtureSave(), "2026-07-13");
  assert.equal(view.actions.length, 3);
  assert.equal(view.actions[0].type, "main");
  assert.equal(view.actions[1].type, "maintenance");
  assert.equal(view.actions[2].type, "freeRecord");
  assert.equal(view.maxDailyExp, 36);
});
```

- [ ] **Step 5: Run UI tests and verify failures**

Run: `node --test tests/ui/status-control.test.mjs tests/ui/main-quest-dialog.test.mjs tests/ui/system-panel.test.mjs`  
Expected: FAIL because the new renderers and view model do not exist.

- [ ] **Step 6: Implement the status control and quest dialog**

Use `data-lucide` names from `getStatusOptions()` and call `globalThis.lucide?.createIcons({ root: element })` after inserting the control. Status changes dispatch one semantic callback:

```js
onStatusChange?.(option.id);
```

The quest dialog receives `save` and lifecycle callbacks; it does not mutate storage itself.

- [ ] **Step 7: Rebuild the morning panel markup**

The top-level action structure must be:

```html
<section class="daily-runtime" aria-label="今日运行">
  <article class="main-action"></article>
  <article class="maintenance-action"></article>
  <div class="free-record-slot"></div>
</section>
```

Remove persistent `+EXP` text from rows. On successful sync, set `data-exp-flash` to `+20`, `+8`, or `+8` for 1200ms without changing element dimensions. Keep level and total EXP in the compact vitals strip.

- [ ] **Step 8: Implement CSS hierarchy and responsive constraints**

Use a desktop grid where the main action spans the larger track and a single-column mobile layout below 760px. Set stable `min-height`, icon-button dimensions, and input bounds so expansion and feedback do not move surrounding content. Keep card radii at 8px or less and reuse the existing morning palette.

- [ ] **Step 9: Wire controller callbacks**

Every callback computes a new save through core functions, persists once, and re-renders once. Do not put quest lifecycle, reward math, or maintenance selection inside `controller.mjs`.

- [ ] **Step 10: Run focused and full tests**

Run: `npm test`  
Expected: all tests PASS; no old test expects five generated tasks or permanent EXP labels.

- [ ] **Step 11: Commit the morning experience**

```bash
git add package.json package-lock.json index.html src/ui/status-control.mjs src/ui/main-quest-dialog.mjs src/ui/system-panel.mjs src/app/controller.mjs src/styles.css tests/ui/status-control.test.mjs tests/ui/main-quest-dialog.test.mjs tests/ui/system-panel.test.mjs
git commit -m "feat: focus morning panel on one main action"
```

### Task 6: Add weekly aggregation and the personal orbital timeline

**Files:**
- Create: `src/core/weekly-archive.mjs`
- Create: `src/ui/personal-timeline.mjs`
- Create: `tests/core/weekly-archive.test.mjs`
- Create: `tests/ui/personal-timeline.test.mjs`

- [ ] **Step 1: Write failing weekly aggregation tests**

```js
test("archiveCompletedWeek creates one idempotent Monday-to-Sunday summary", () => {
  const save = fixtureWithEventsForWeek("2026-07-06");
  const first = archiveCompletedWeek(save, new Date(2026, 6, 13, 8, 0, 0));
  const second = archiveCompletedWeek(first, new Date(2026, 6, 13, 8, 1, 0));
  assert.equal(first.weeklyArchive.length, 1);
  assert.equal(second.weeklyArchive.length, 1);
  assert.deepEqual(first.weeklyArchive[0].range, {
    start: "2026-07-06",
    end: "2026-07-12",
  });
});
```

Assert the summary counts main dates, maintenance, free records, quest lifecycle, unlocks, and important records without copying every daily event into the weekly node.

- [ ] **Step 2: Write failing weekly-note tests**

`setWeeklyNote(save, weekKey, text, now)` must trim text, update one node, and remove the note when text is empty. It must not change `level`, `rewardLedger`, or achievements.

- [ ] **Step 3: Write failing timeline-view tests**

```js
test("buildTimelineView returns quiet week nodes and bright milestones", () => {
  const view = buildTimelineView(fixtureArchive());
  assert.equal(view.nodes[0].type, "week");
  assert.ok(view.nodes.some((node) => node.type === "quest_completed" && node.emphasis === "milestone"));
  assert.equal(view.nodes.some((node) => node.type === "daily_task"), false);
});
```

- [ ] **Step 4: Run focused tests and verify missing modules**

Run: `node --test tests/core/weekly-archive.test.mjs tests/ui/personal-timeline.test.mjs`  
Expected: FAIL with missing-module errors.

- [ ] **Step 5: Implement idempotent weekly archives**

Use the local week start as the stable ID:

```js
{
  id: "week:2026-07-06",
  range: { start: "2026-07-06", end: "2026-07-12" },
  counts: { mainDays: 3, maintenance: 2, freeRecords: 1 },
  milestones: [],
  summary: "主线推进 3 天，完成 2 次维护，留下 1 条记录。",
  note: "",
  createdAt: "2026-07-13T00:00:00.000Z",
  seenAt: null,
}
```

- [ ] **Step 6: Implement the orbital timeline renderer**

Render a single unframed `<ol class="orbital-timeline">`; week nodes use small points, milestone nodes use a larger point and `data-emphasis="milestone"`. Only the newest unseen week gets `is-new`; marking it seen must be a separate callback after the entrance animation.

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/core/weekly-archive.test.mjs tests/ui/personal-timeline.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 8: Commit weekly trajectory behavior**

```bash
git add src/core/weekly-archive.mjs src/ui/personal-timeline.mjs tests/core/weekly-archive.test.mjs tests/ui/personal-timeline.test.mjs
git commit -m "feat: archive life progress by week"
```

### Task 7: Add the six runtime achievements

**Files:**
- Create: `src/core/runtime-achievements.mjs`
- Modify: `src/core/achievement-catalog.mjs`
- Modify: `src/core/progression.mjs`
- Create: `tests/core/runtime-achievements.test.mjs`
- Modify: `tests/core/achievement-catalog.test.mjs`
- Modify: `tests/ui/achievement-toast.test.mjs`

- [ ] **Step 1: Write failing rule tests for all six achievements**

Use table-driven fixtures:

```js
const CASES = [
  ["route-online", [event("main_action_synced", "2026-07-01")]],
  ["steady-progress", distinctMainDates(7)],
  ["long-voyage", distinctMainDates(30)],
  ["maintenance-protocol", repeatedEvents("maintenance_synced", 10)],
  ["unexpected-gain", repeatedEvents("free_record_saved", 5)],
  ["mission-complete", [event("quest_completed", "2026-07-01")]],
];

for (const [id, activityEvents] of CASES) {
  test(`unlocks ${id} once`, () => {
    const first = unlockRuntimeAchievements({ activityEvents, achievements: [] });
    const second = unlockRuntimeAchievements(first);
    assert.equal(first.achievements.filter((item) => item.achievementId === id).length, 1);
    assert.equal(second.achievements.filter((item) => item.achievementId === id).length, 1);
  });
}
```

Add a separate assertion that 30 same-day main events count as one distinct date and unlock only `route-online`.

- [ ] **Step 2: Define the runtime catalog**

Use fixed world-model estimates so refreshes never change the archive:

```js
export const RUNTIME_ACHIEVEMENT_CATALOG = Object.freeze([
  { id: "route-online", title: "航线接入", rarityPercent: 82.4, iconAsset: "./assets/achievements/runtime/route-online.png" },
  { id: "steady-progress", title: "稳定推进", rarityPercent: 41.7, iconAsset: "./assets/achievements/runtime/steady-progress.png" },
  { id: "long-voyage", title: "长期航行", rarityPercent: 12.8, iconAsset: "./assets/achievements/runtime/long-voyage.png" },
  { id: "maintenance-protocol", title: "维护协议", rarityPercent: 29.4, iconAsset: "./assets/achievements/runtime/maintenance-protocol.png" },
  { id: "unexpected-gain", title: "意外收获", rarityPercent: 33.6, iconAsset: "./assets/achievements/runtime/unexpected-gain.png" },
  { id: "mission-complete", title: "任务完成", rarityPercent: 18.2, iconAsset: "./assets/achievements/runtime/mission-complete.png" },
]);
```

Each complete definition must also include one short Chinese description, `recordType: "runtime"`, category, and rule metadata. Do not award EXP or titles in these definitions.

- [ ] **Step 3: Run tests and verify rule failures**

Run: `node --test tests/core/runtime-achievements.test.mjs tests/core/achievement-catalog.test.mjs tests/ui/achievement-toast.test.mjs`  
Expected: FAIL until the runtime catalog and rules are integrated.

- [ ] **Step 4: Implement event-derived rules**

Count distinct `localDate` values for main progress. Count unique event IDs for maintenance and free records. Append instances with `source: "runtime"`, `hidden: false`, `displayable: true`, and `spotlightAllowed: true`. Reuse the existing toast queue; do not add sound or pre-unlock notices.

- [ ] **Step 5: Run focused tests and the full suite**

Run: `npm test`  
Expected: all tests PASS; the legacy `npc_filter` migration test is either retained as a legacy instance test or explicitly rewritten so it no longer acts as a v0.3 auto-unlock.

- [ ] **Step 6: Commit runtime achievement rules**

```bash
git add src/core/runtime-achievements.mjs src/core/achievement-catalog.mjs src/core/progression.mjs tests/core/runtime-achievements.test.mjs tests/core/achievement-catalog.test.mjs tests/ui/achievement-toast.test.mjs
git commit -m "feat: add runtime achievement records"
```

### Task 8: Generate and validate runtime achievement crests

**Files:**
- Create: `assets/achievements/runtime/route-online.png`
- Create: `assets/achievements/runtime/mission-complete.png`
- Create after approval: `assets/achievements/runtime/steady-progress.png`
- Create after approval: `assets/achievements/runtime/long-voyage.png`
- Create after approval: `assets/achievements/runtime/maintenance-protocol.png`
- Create after approval: `assets/achievements/runtime/unexpected-gain.png`
- Modify: `OPEN_SOURCE_REFERENCES.md`

- [ ] **Step 1: Generate the two required sample crests with GPT Image 2**

Use Image 2 separately for each crest with this locked base prompt:

```text
Create a single premium achievement crest for Earth Online, square 1:1, pure near-black background. Cold silver metallic linework and flat emblem shapes, one tiny restrained cyan signal light, precise orbital-system visual language, elegant and mature, no game loot styling. One centered subject with about 12 percent safe margin. Consistent medium line width, crisp silhouette readable at 64 pixels. No text, no letters, no numbers, no percentage, no trophy, no UI card, no mockup, no photorealism, no thick glow, no rainbow gradient.
```

Append `an orbital route connecting to one illuminated Earth-side node` for `route-online.png`. Append `a completed route arriving at a calm terminal beacon, clearly conclusive but not triumphant` for `mission-complete.png`.

- [ ] **Step 2: Validate the two samples before generating four more**

Open both assets at 1024px and 64px. Verify: same visual family, recognizable silhouette, cold silver rather than warm gold, only one cyan signal accent, no text artifacts, and no heavy glow. Show both in the actual runtime achievement card and pause for user approval.

- [ ] **Step 3: Generate the remaining four assets only after approval**

Reuse the identical base prompt with these subjects:

```text
steady-progress: seven small route nodes forming a stable forward arc
long-voyage: a long orbital path passing many sparse waypoints toward a distant beacon
maintenance-protocol: a precise system pulse stabilizing a circular mechanism
unexpected-gain: a small unexpected signal emerging beside an otherwise quiet route
```

- [ ] **Step 4: Record provenance and visual constraints**

Add to `OPEN_SOURCE_REFERENCES.md` that status icons use Lucide under ISC and runtime achievement raster crests were generated with GPT Image 2 from the locked v0.3 crest prompt. Do not claim the generated assets are from Lucide.

- [ ] **Step 5: Commit approved assets**

```bash
git add assets/achievements/runtime/route-online.png assets/achievements/runtime/mission-complete.png assets/achievements/runtime/steady-progress.png assets/achievements/runtime/long-voyage.png assets/achievements/runtime/maintenance-protocol.png assets/achievements/runtime/unexpected-gain.png OPEN_SOURCE_REFERENCES.md
git commit -m "feat: add runtime achievement crests"
```

### Task 9: Add the three-layer Night Archive experience

**Files:**
- Modify: `src/ui/night-archive.mjs`
- Modify: `src/ui/personal-timeline.mjs`
- Modify: `src/styles/achievements.css`
- Modify: `src/app/controller.mjs`
- Modify: `tests/ui/night-archive.test.mjs`
- Modify: `tests/ui/personal-timeline.test.mjs`

- [ ] **Step 1: Write failing three-layer view-model tests**

```js
test("buildArchiveSections separates life, runtime, and trajectory records", () => {
  const sections = buildArchiveSections(fixtureSave());
  assert.deepEqual(sections.map((section) => section.id), ["life", "runtime", "trajectory"]);
  assert.ok(sections[0].items.every((item) => item.recordType === "life"));
  assert.ok(sections[1].items.every((item) => item.recordType === "runtime"));
  assert.ok(sections[2].nodes.every((node) => node.type !== "daily_task"));
});
```

Add tests that existing `all`, `confirmed`, `unconfirmed`, and `hidden` filters still apply to life records and that runtime records do not enter old-save review.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `node --test tests/ui/night-archive.test.mjs tests/ui/personal-timeline.test.mjs`  
Expected: FAIL until the three-section model exists.

- [ ] **Step 3: Implement the archive navigation and sections**

Use three text tabs or a restrained segmented control labeled `人生记录`, `运行记录`, and `个人轨迹`. Keep the day-return icon in its current fixed position. Do not create a separate route or page; all sections remain inside the same Night Archive shell.

- [ ] **Step 4: Implement distinct but related materials**

Life records retain warm gold. Runtime records use CSS variables:

```css
.achievement-card[data-record-type="runtime"] {
  --record-metal: #c7d3d8;
  --record-signal: #72d6df;
  --record-border: rgba(159, 187, 196, 0.28);
}
```

The timeline uses a dark-blue rail and node light only; it must not reuse the crest frame or rarity metal. Avoid page-level gold washes and nested cards.

- [ ] **Step 5: Integrate weekly seen-state and notes**

Entering the trajectory section may mark only the latest unseen week as seen after its one-time entrance animation. Weekly note edits call `setWeeklyNote` and do not trigger EXP or achievement evaluation.

- [ ] **Step 6: Run focused and full tests**

Run: `npm test`  
Expected: all archive, old-save, transition, toast, and new timeline tests PASS.

- [ ] **Step 7: Commit the Night Archive expansion**

```bash
git add src/ui/night-archive.mjs src/ui/personal-timeline.mjs src/styles/achievements.css src/app/controller.mjs tests/ui/night-archive.test.mjs tests/ui/personal-timeline.test.mjs
git commit -m "feat: add runtime and trajectory archives"
```

### Task 10: Add IndexedDB rolling snapshots

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/core/snapshot-store.mjs`
- Create: `tests/core/snapshot-store.test.mjs`

- [ ] **Step 1: Add the IndexedDB test adapter**

Run: `npm install fake-indexeddb@6.0.1 --save-dev --save-exact`  
Expected: the exact dev dependency is recorded in `package.json` and `package-lock.json`.

- [ ] **Step 2: Write failing snapshot retention tests**

```js
import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { createSnapshotStore } from "../../src/core/snapshot-store.mjs";

test("daily snapshots keep one per date and retain the newest fourteen", async () => {
  const store = createSnapshotStore({ indexedDB: globalThis.indexedDB, dbName: "snapshot-daily-test" });
  for (let day = 1; day <= 16; day += 1) {
    const date = `2026-07-${String(day).padStart(2, "0")}`;
    await store.createDaily({ format: "earth-online-save-v1", marker: day }, date);
    await store.createDaily({ format: "earth-online-save-v1", marker: `${day}-duplicate` }, date);
  }
  const items = await store.list();
  const daily = items.filter((item) => item.type === "daily");
  assert.equal(daily.length, 14);
  assert.equal(daily[0].localDate, "2026-07-16");
  assert.equal(daily.at(-1).localDate, "2026-07-03");
});
```

- [ ] **Step 3: Write failing key-snapshot and restore tests**

Assert that key snapshots retain five items, include `quest_complete`, `before_import`, or `before_restore` reasons, and `restore(id, currentSave)` creates `before_restore` before returning the selected save.

- [ ] **Step 4: Run focused tests and verify missing module failure**

Run: `node --test tests/core/snapshot-store.test.mjs`  
Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 5: Implement the snapshot store**

Create database `earth-online-snapshots`, version 1, object store `snapshots`, key path `id`, and indexes for `type`, `localDate`, and `createdAt`. Store records in this shape:

```js
{
  id: "daily:2026-07-13",
  type: "daily",
  reason: "daily_start",
  localDate: "2026-07-13",
  createdAt: "2026-07-13T00:01:00.000Z",
  save: structuredClone(save),
}
```

Use a transaction for insert plus retention pruning. Reject malformed records without deleting an existing snapshot.

- [ ] **Step 6: Run snapshot and storage tests**

Run: `node --test tests/core/snapshot-store.test.mjs tests/core/storage.test.mjs`  
Expected: all tests PASS.

- [ ] **Step 7: Commit the snapshot store**

```bash
git add package.json package-lock.json src/core/snapshot-store.mjs tests/core/snapshot-store.test.mjs
git commit -m "feat: add rolling local save snapshots"
```

### Task 11: Integrate save recovery and high-risk operation guards

**Files:**
- Create: `src/ui/save-recovery.mjs`
- Modify: `src/app/controller.mjs`
- Modify: `src/ui/system-panel.mjs`
- Modify: `src/styles.css`
- Create: `tests/ui/save-recovery.test.mjs`
- Modify: `tests/core/storage.test.mjs`
- Modify: `tests/ui/system-panel.test.mjs`

- [ ] **Step 1: Write failing recovery view tests**

```js
test("buildRecoveryView lists snapshots newest first with readable reasons", () => {
  const view = buildRecoveryView([
    snapshot("daily:2026-07-12", "daily", "daily_start", "2026-07-12T00:01:00.000Z"),
    snapshot("key:import", "key", "before_import", "2026-07-13T08:00:00.000Z"),
  ]);
  assert.equal(view[0].id, "key:import");
  assert.equal(view[0].reasonLabel, "导入前备份");
  assert.equal(view[1].reasonLabel, "每日恢复点");
});
```

Render tests must assert an explicit restore confirmation and a visible unavailable state when the store cannot open.

- [ ] **Step 2: Write failing controller integration tests around injected services**

Extract persistence coordination into testable functions that accept `snapshotStore` and `storage`. Assert:

1. First valid mutation of a date creates one daily snapshot before saving.
2. Quest completion creates `quest_complete` before archiving.
3. A valid import creates `before_import` before replacement.
4. Invalid import creates no snapshot and leaves storage untouched.
5. Restore creates `before_restore` before replacing current save.

- [ ] **Step 3: Run focused tests and verify failures**

Run: `node --test tests/ui/save-recovery.test.mjs tests/core/storage.test.mjs tests/ui/system-panel.test.mjs`  
Expected: FAIL until recovery UI and coordination hooks exist.

- [ ] **Step 4: Implement save-recovery UI**

Place one `存档管理` command beside export/import in the low-frequency footer. The overlay contains `恢复历史存档`, snapshot rows, and icon buttons with tooltips. Do not show JSON. Restore confirmation text must name the selected time and state that the current save will first be backed up.

- [ ] **Step 5: Integrate daily and key snapshot hooks**

Add one controller helper:

```js
async function persist(nextSave, { keyReason = null } = {}) {
  const today = getLocalDateKey();
  if (keyReason) {
    await snapshotStore.createKey(state.save, keyReason, today);
  } else {
    await snapshotStore.createDaily(state.save, today);
  }
  state.save = saveLocalSave(nextSave);
  return state.save;
}
```

Catch snapshot failures. Ordinary edits continue and expose the failure in save management. Before import or quest completion, show a compact confirmation allowing cancel or explicit continue without recovery point.

- [ ] **Step 6: Run focused and full tests**

Run: `npm test`  
Expected: all tests PASS, including malformed import and inaccessible-storage regressions.

- [ ] **Step 7: Commit recovery integration**

```bash
git add src/ui/save-recovery.mjs src/app/controller.mjs src/ui/system-panel.mjs src/styles.css tests/ui/save-recovery.test.mjs tests/core/storage.test.mjs tests/ui/system-panel.test.mjs
git commit -m "feat: add local save recovery controls"
```

### Task 12: Run complete regression and visual QA

**Files:**
- Modify if defects are found: `src/styles.css`
- Modify if defects are found: `src/styles/achievements.css`
- Modify if defects are found: focused source and test files from Tasks 1-11
- Modify: `OPEN_SOURCE_REFERENCES.md`

- [ ] **Step 1: Run the complete automated suite**

Run: `npm test`  
Expected: PASS with zero failures, zero skipped tests, and coverage of migration, local dates, rewards, quest lifecycle, daily slots, weekly archive, runtime achievements, snapshots, and existing day/night behavior.

- [ ] **Step 2: Start an isolated preview server**

Run: `$env:PORT=58806; npm start`  
Expected: `Earth Online listening on http://localhost:58806` and the existing `58805` preview remains untouched.

- [ ] **Step 3: Verify desktop behavior at 1440x1000**

Use browser automation to verify: create or migrate a main quest, choose each status, replace maintenance once, sync all three action types, add extra main progress, edit/delete the free record, open the quest dialog, and switch day/night. Capture morning and all three Night Archive sections.

- [ ] **Step 4: Verify mobile behavior at 390x844**

Confirm no horizontal scrolling, clipped Chinese text, nested-card crowding, layout shift during EXP feedback, or controls below unreachable overlays. Confirm the status popover and recovery confirmation remain within the viewport.

- [ ] **Step 5: Verify 3D Earth regression and transitions**

Capture canvas pixels before and after rotation to confirm the globe remains nonblank and moving. Enter and leave the Night Archive repeatedly, click during transition to skip, and enable reduced motion. Confirm no black screen, duplicate panel, stuck overlay, or lost exit path.

- [ ] **Step 6: Verify visual hierarchy and asset quality**

At normal zoom, confirm the main action is the first visual target, status icons are recognizable without color, life/runtime/timeline records are visibly distinct, runtime crests remain readable at 64px, and no task description paragraphs have returned.

- [ ] **Step 7: Verify persistence manually**

Reload after each daily action, export/import the save, restore one daily snapshot, restore one key snapshot, and then undo that restore via `before_restore`. Confirm no duplicate EXP, events, weekly nodes, or achievements.

- [ ] **Step 8: Fix only defects discovered by QA and rerun affected tests**

For each defect, first add or tighten the smallest reproducing test, run it to observe failure, apply the minimal fix, and run both the focused test and `npm test`.

- [ ] **Step 9: Commit the verified release candidate**

```bash
git add src tests assets OPEN_SOURCE_REFERENCES.md package.json package-lock.json index.html
git commit -m "fix: complete earth online v0.3 qa"
```

- [ ] **Step 10: Report the preview and checkpoint**

Report the preview URL, total passing test count, screenshots checked, any remaining browser-only risk, branch name, and final commit hash. Do not merge or push until the user chooses the integration path.
