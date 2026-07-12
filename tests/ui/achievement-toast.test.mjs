import test from "node:test";
import assert from "node:assert/strict";

import {
  createAchievementToastQueue,
  getNewAchievementIds,
} from "../../src/ui/achievement-toast.mjs";

test("achievement delta accepts canonical and legacy IDs without duplicates", () => {
  assert.deepEqual(getNewAchievementIds(
    [{ id: "old" }],
    [{ id: "old" }, { achievementId: "new" }, { id: "new" }, null],
  ), ["new"]);
});

test("toast queue displays one record at a time", async () => {
  const shown = [];
  const queue = createAchievementToastQueue({
    show: async (id) => {
      shown.push(`start:${id}`);
      await Promise.resolve();
      shown.push(`end:${id}`);
    },
  });

  await Promise.all([queue.enqueue("a"), queue.enqueue("b")]);
  assert.deepEqual(shown, ["start:a", "end:a", "start:b", "end:b"]);
});

test("toast queue continues after one presentation fails", async () => {
  const shown = [];
  const queue = createAchievementToastQueue({
    show: async (id) => {
      shown.push(id);
      if (id === "broken") throw new Error("render failed");
    },
  });

  await assert.rejects(queue.enqueue("broken"));
  await queue.enqueue("next");
  assert.deepEqual(shown, ["broken", "next"]);
});
