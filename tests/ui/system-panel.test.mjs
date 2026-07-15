import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildMorningView,
  completePanelTask,
  getArchiveEntryState,
  getDailySyncStats,
  getDailyTasksForSave,
  getMorningPanelMarkup,
  getOnlineStreakDays,
  getTaskActionState,
  getTaskCompletionMessage,
} from "../../src/ui/system-panel.mjs";

test("buildMorningView makes the main action primary and exposes three slots", () => {
  const save = {
    currentStatus: "stable_operation",
    mainQuest: { id: "quest-1", title: "完成 v0.3", status: "active" },
    dailyRuns: [{
      date: "2026-07-13",
      status: "stable_operation",
      mainAction: { text: "完成清晨面板", syncedAt: null },
      maintenance: { itemId: "drink-water", title: "喝一杯水", completedAt: null },
      freeRecord: null,
    }],
    level: { value: 22, exp: 7414, nextLevelExp: 7744, progress: 0.9 },
    titles: ["观察者"],
    settings: { selectedTitle: "观察者" },
  };

  const view = buildMorningView(save, "2026-07-13");

  assert.deepEqual(view.actions.map((action) => action.type), ["main", "maintenance", "freeRecord"]);
  assert.equal(view.actions[0].primary, true);
  assert.equal(view.actions[0].title, "完成清晨面板");
  assert.equal(view.maxDailyExp, 36);
  assert.equal(view.level.value, 22);
});

test("buildMorningView exposes an explicit empty main quest state", () => {
  const view = buildMorningView({
    currentStatus: "stable_operation",
    mainQuest: null,
    dailyRuns: [{
      date: "2026-07-13",
      status: "stable_operation",
      mainAction: null,
      maintenance: { itemId: "drink-water", title: "喝一杯水", completedAt: null },
      freeRecord: null,
    }],
    level: { value: 1, exp: 0, nextLevelExp: 16, progress: 0 },
  }, "2026-07-13");

  assert.equal(view.actions[0].empty, true);
  assert.equal(view.actions[0].title, "当前没有激活主线");
  assert.equal(view.actions[0].actionLabel, "设定主线");
});

test("free record reward availability follows the daily reward ledger", () => {
  const base = {
    currentStatus: "stable_operation",
    mainQuest: null,
    dailyRuns: [{
      date: "2026-07-13",
      status: "stable_operation",
      mainAction: null,
      maintenance: { itemId: "drink-water", title: "喝一杯水", completedAt: null },
      freeRecord: { text: "已经留下记录", important: false },
    }],
    level: { value: 1, exp: 8, nextLevelExp: 16, progress: 0.5 },
  };

  assert.equal(buildMorningView({ ...base, rewardLedger: [] }, "2026-07-13").actions[2].rewardAvailable, true);
  assert.equal(buildMorningView({
    ...base,
    rewardLedger: [{ key: "2026-07-13:free-record", exp: 8 }],
  }, "2026-07-13").actions[2].rewardAvailable, false);
});

test("morning markup gives one main action and two quieter support slots", () => {
  const view = buildMorningView({
    currentStatus: "stable_operation",
    mainQuest: { title: "完成 Earth Online v0.3", status: "active" },
    dailyRuns: [{
      date: "2026-07-13",
      status: "stable_operation",
      mainAction: { text: "完成清晨面板", syncedAt: null, additionalProgress: [] },
      maintenance: { title: "喝一杯水", completedAt: null, replacementCount: 0 },
      freeRecord: null,
    }],
    level: { value: 22, exp: 7414, nextLevelExp: 7744, progress: 0.9 },
  }, "2026-07-13");

  const markup = getMorningPanelMarkup(view, {
    nickname: "未命名玩家",
    selectedTitle: "观察者",
    tags: ["INTP"],
    archiveEntry: { label: "进入夜间档案馆", badge: "12 项记录" },
  });

  assert.match(markup, /<section class="daily-runtime" aria-label="今日运行">/);
  assert.match(markup, /<article class="main-action/);
  assert.match(markup, /<article class="maintenance-action/);
  assert.match(markup, /<div class="free-record-slot/);
  assert.doesNotMatch(markup, /\+20|\+8/);
});

test("hidden inline forms remain collapsed until the player opens them", async () => {
  const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\[hidden\]\s*\{\s*display:\s*none\s*!important;/);
});

test("mobile free record editing expands instead of clipping its actions", async () => {
  const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /\.free-record-slot\.is-editing\s*\{[^}]*min-height:\s*11rem;/s);
  assert.match(styles, /\.free-record-slot\.is-editing \.free-record-form input[^}]*grid-column:\s*1\s*\/\s*-1;/s);
});

test("archive entry announces pending old-save review", () => {
  assert.deepEqual(getArchiveEntryState({
    achievementArchive: { scanStatus: "review", candidateIds: ["academic-complete"] },
    achievements: [],
  }), {
    label: "进入夜间档案馆",
    badge: "1 条待确认",
  });
});

test("archive entry falls back to the known record count", () => {
  assert.deepEqual(getArchiveEntryState({
    achievementArchive: { scanStatus: "complete", candidateIds: [] },
    achievements: [
      { id: "academic-complete" },
      { achievementId: "first-job" },
      { achievementId: "unknown" },
      null,
    ],
  }), {
    label: "进入夜间档案馆",
    badge: "2 项记录",
  });
});

test("getDailyTasksForSave reuses today's tasks without changing save", () => {
  const today = "2026-06-21";
  const existingTask = {
    id: "2026-06-21-1-existing",
    date: today,
    title: "Keep existing route",
    categoryLabel: "Route",
    exp: 12,
    order: 1,
    completed: false,
  };
  const save = {
    currentStatus: "stable_operation",
    dailyTasks: [existingTask],
  };

  const result = getDailyTasksForSave(save, today);

  assert.equal(result.changed, false);
  assert.equal(result.save, save);
  assert.deepEqual(result.tasks, [existingTask]);
});

test("getDailyTasksForSave localizes legacy English tasks in today's save", () => {
  const today = "2026-06-21";
  const save = {
    currentStatus: "stable_operation",
    dailyTasks: [
      {
        id: "2026-06-21-1-input-reading",
        date: today,
        title: "Read one bounded input source",
        category: "cognitive_input",
        categoryLabel: "Cognitive input",
        exp: 16,
        order: 1,
        completed: false,
      },
    ],
  };

  const result = getDailyTasksForSave(save, today);

  assert.equal(result.changed, true);
  assert.notEqual(result.save, save);
  assert.equal(result.tasks[0].title, "\u9605\u8bfb\u4e00\u4efd\u6709\u8fb9\u754c\u7684\u4fe1\u606f\u6e90");
  assert.equal(result.save.dailyTasks[0].title, "\u9605\u8bfb\u4e00\u4efd\u6709\u8fb9\u754c\u7684\u4fe1\u606f\u6e90");
});

test("getDailyTasksForSave can preview generated tasks without requesting persistence", () => {
  const today = "2026-06-21";
  const save = {
    currentStatus: "stable_operation",
    dailyTasks: [],
  };

  const result = getDailyTasksForSave(save, today, { persistGeneratedTasks: false });

  assert.equal(result.changed, false);
  assert.notEqual(result.save, save);
  assert.equal(save.dailyTasks.length, 0);
  assert.ok(result.tasks.length > 0);
  assert.equal(result.generated, true);
  assert.deepEqual(result.save.dailyTasks, result.tasks);
});

test("getTaskActionState uses sync-oriented labels", () => {
  const pendingTask = { completed: false };
  const completedTask = { completed: true };

  assert.deepEqual(
    getTaskActionState(pendingTask, { allowCompletion: false }),
    { disabled: true, label: "预览" },
  );
  assert.deepEqual(
    getTaskActionState(pendingTask, { allowCompletion: true }),
    { disabled: false, label: "同步" },
  );
  assert.deepEqual(
    getTaskActionState(completedTask, { allowCompletion: false }),
    { disabled: true, label: "已同步" },
  );
});

test("getDailySyncStats summarizes today's completion progress", () => {
  assert.deepEqual(
    getDailySyncStats([
      { completed: true },
      { completed: false },
      { completed: true },
      { completed: false },
    ]),
    { completed: 2, total: 4, percent: 50, label: "2 / 4" },
  );
});

test("getOnlineStreakDays counts consecutive task dates through today", () => {
  const save = {
    dailyTasks: [
      { date: "2026-06-21" },
      { date: "2026-06-22" },
      { date: "2026-06-23" },
      { date: "2026-06-25" },
    ],
  };

  assert.equal(getOnlineStreakDays(save, "2026-06-25"), 1);
  assert.equal(getOnlineStreakDays({
    dailyTasks: [
      { date: "2026-06-23" },
      { date: "2026-06-24" },
      { date: "2026-06-25" },
    ],
  }, "2026-06-25"), 3);
});

test("task completion copy uses Earth Online tone", () => {
  assert.equal(
    getTaskCompletionMessage({ category: "cognitive_input" }),
    "\u5df2\u8bb0\u5f55\uff1a\u4e00\u6b21\u8ba4\u77e5\u7ef4\u62a4\u5b8c\u6210\u3002",
  );
});

test("completePanelTask records task history once and applies EXP", () => {
  const task = {
    id: "2026-06-21-1-existing",
    date: "2026-06-21",
    title: "Keep existing route",
    categoryLabel: "Route",
    exp: 20,
    order: 1,
    completed: false,
  };
  const save = {
    level: { value: 1, exp: 0, nextLevelExp: 16, progress: 0 },
    dailyTasks: [task],
    taskHistory: [],
  };

  const first = completePanelTask(save, task.id, "2026-06-21T12:00:00.000Z");
  const second = completePanelTask(first, task.id, "2026-06-21T12:01:00.000Z");
  const unknown = completePanelTask(second, "missing-task", "2026-06-21T12:02:00.000Z");

  assert.equal(first.dailyTasks[0].completed, true);
  assert.equal(first.taskHistory.length, 1);
  assert.equal(first.taskHistory[0].id, task.id);
  assert.equal(first.level.exp, 20);
  assert.equal(second.taskHistory.length, 1);
  assert.equal(second.level.exp, 20);
  assert.equal(unknown.taskHistory.length, 1);
  assert.equal(unknown.level.exp, 20);
});

test("completePanelTask unlocks NPC filter runtime rewards", () => {
  const task = {
    id: "2026-06-21-3-npc",
    date: "2026-06-21",
    title: "Tune NPC channel",
    category: "npc_noise_reduction",
    categoryLabel: "NPC",
    exp: 20,
    order: 3,
    completed: false,
  };
  const save = {
    level: { value: 1, exp: 0, nextLevelExp: 16, progress: 0 },
    dailyTasks: [task],
    taskHistory: [
      { id: "older-npc-1", category: "npc_noise_reduction", completed: true },
      { id: "older-npc-2", category: "npc_noise_reduction", completed: true },
    ],
    achievements: [],
    titles: [],
    tags: [],
  };

  const next = completePanelTask(save, task.id, "2026-06-21T12:00:00.000Z");

  assert.ok(next.achievements.some((item) => item.achievementId === "npc_filter"));
  assert.ok(next.titles.includes("NPC过滤器"));
  assert.ok(next.tags.includes("NPC过滤器"));
});
