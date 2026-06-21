import test from "node:test";
import assert from "node:assert/strict";
import { RUNTIME_STATUSES, TASK_CATEGORIES } from "../../src/core/constants.mjs";
import { completeTask, expireTask, generateDailyTasks } from "../../src/core/tasks.mjs";

test("generateDailyTasks returns three high load tasks including NPC category", () => {
  const tasks = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.HIGH_LOAD,
    mainQuest: { title: "\u5730\u7403 Online" },
  });

  assert.equal(tasks.length, 3);
  assert.ok(tasks.some((task) => task.category === TASK_CATEGORIES.NPC));
});

test("generateDailyTasks includes main quest and custom source during stable operation", () => {
  const tasks = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.STABLE,
    mainQuest: { title: "\u5730\u7403 Online" },
    customTaskPool: [
      {
        id: "custom-note-review",
        title: "Archive one useful note",
        category: TASK_CATEGORIES.OUTPUT,
        exp: 18,
      },
    ],
  });

  assert.equal(tasks.length, 5);
  assert.ok(tasks.some((task) => task.title.includes("\u5730\u7403 Online")));
  assert.ok(tasks.some((task) => task.source === "custom"));
});

test("completeTask marks task completed and returns gained exp", () => {
  const task = {
    id: "task-1",
    title: "System check",
    exp: 24,
    completed: false,
  };
  const result = completeTask(task, "2026-06-21T20:24:00+08:00");

  assert.equal(result.gainedExp, 24);
  assert.equal(result.task.completed, true);
  assert.equal(result.task.completedAt, "2026-06-21T20:24:00+08:00");
});

test("generateDailyTasks ignores malformed customTaskPool object", () => {
  assert.doesNotThrow(() => {
    const tasks = generateDailyTasks({
      date: "2026-06-21",
      status: RUNTIME_STATUSES.STABLE,
      mainQuest: { title: "\u5730\u7403 Online" },
      customTaskPool: { title: "Not an array" },
    });

    assert.equal(tasks.length, 5);
  });
});

test("generateDailyTasks skips custom entries without non-empty titles", () => {
  const tasks = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.STABLE,
    mainQuest: { title: "\u5730\u7403 Online" },
    customTaskPool: [
      { id: "missing-title", category: TASK_CATEGORIES.OUTPUT },
      { id: "blank-title", title: "   ", category: TASK_CATEGORIES.OUTPUT },
      { id: "valid-custom", title: "Write one line", category: TASK_CATEGORIES.OUTPUT },
    ],
  });

  assert.equal(tasks.length, 5);
  assert.equal(tasks.filter((task) => task.source === "custom").length, 1);
  assert.ok(tasks.some((task) => task.title === "Write one line"));
});

test("generateDailyTasks normalizes unknown custom category to output", () => {
  const tasks = generateDailyTasks({
    date: "2026-06-21",
    status: RUNTIME_STATUSES.STABLE,
    mainQuest: { title: "\u5730\u7403 Online" },
    customTaskPool: [
      {
        id: "custom-unknown-category",
        title: "Ship a small note",
        category: "unknown_category",
        exp: 18,
      },
    ],
  });
  const customTask = tasks.find((task) => task.source === "custom");

  assert.equal(customTask.category, TASK_CATEGORIES.OUTPUT);
  assert.equal(customTask.categoryLabel, "\u521b\u4f5c\u8f93\u51fa");
});

test("expireTask returns expired copy without mutating original task", () => {
  const task = {
    id: "task-1",
    title: "System check",
    expired: false,
  };
  const expired = expireTask(task, "2026-06-21T20:24:00+08:00");

  assert.equal(expired.expired, true);
  assert.equal(expired.expiredAt, "2026-06-21T20:24:00+08:00");
  assert.equal(task.expired, false);
  assert.equal(task.expiredAt, undefined);
  assert.notEqual(expired, task);
});
