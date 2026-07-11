import test from "node:test";
import assert from "node:assert/strict";
import {
  completePanelTask,
  getDailySyncStats,
  getDailyTasksForSave,
  getOnlineStreakDays,
  getTaskActionState,
  getTaskCompletionMessage,
} from "../../src/ui/system-panel.mjs";

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

  assert.ok(next.achievements.some((item) => item.id === "npc_filter"));
  assert.ok(next.titles.includes("NPC过滤器"));
  assert.ok(next.tags.includes("NPC过滤器"));
});
