import test from "node:test";
import assert from "node:assert/strict";
import { RUNTIME_STATUSES, TASK_CATEGORIES } from "../../src/core/constants.mjs";
import { completeTask, generateDailyTasks } from "../../src/core/tasks.mjs";

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
