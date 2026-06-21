import test from "node:test";
import assert from "node:assert/strict";
import { applyExp, getLevelFromExp, getRarity, unlockRuntimeAchievements } from "../../src/core/progression.mjs";

test("getLevelFromExp uses slower growth at higher levels", () => {
  assert.equal(getLevelFromExp(0).value, 1);
  assert.equal(getLevelFromExp(1800).value, 11);
  assert.equal(getLevelFromExp(8000).value, 23);
  assert.ok(getLevelFromExp(8000).value > getLevelFromExp(1800).value);
});

test("applyExp updates level progress", () => {
  const level = applyExp({ value: 1, exp: 0, nextLevelExp: 100 }, 140);

  assert.ok(level.exp >= 140);
  assert.ok(level.value >= 2);
  assert.ok(level.nextLevelExp > level.exp);
});

test("progression functions handle non-finite inputs safely", () => {
  const infiniteLevel = getLevelFromExp(Infinity);
  const nanLevel = getLevelFromExp(NaN);
  const gainedInfinity = applyExp({ value: 1, exp: 0, nextLevelExp: 16 }, Infinity);

  for (const level of [infiniteLevel, nanLevel, gainedInfinity]) {
    assert.equal(Number.isFinite(level.value), true);
    assert.equal(Number.isFinite(level.exp), true);
    assert.equal(Number.isFinite(level.nextLevelExp), true);
    assert.equal(Number.isFinite(level.progress), true);
  }

  assert.equal(nanLevel.value, 1);
  assert.equal(gainedInfinity.value, 1);
});

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
  assert.deepEqual(next.achievements[0], {
    id: "npc_filter",
    label: "拒绝无效消耗",
    rarity: getRarity("npc_filter", 4.0, 12.0),
    rarityLabel: "全服",
    source: "runtime",
    unlockedAt: "2026-06-21T20:24:00+08:00",
  });
  assert.ok(next.titles.includes("NPC过滤器"));
  assert.ok(next.tags.includes("NPC过滤器"));
  assert.deepEqual(save.achievements, []);
});

test("unlockRuntimeAchievements avoids duplicate NPC filter rewards", () => {
  const save = {
    achievements: [{
      id: "npc_filter",
      label: "拒绝无效消耗",
      rarity: getRarity("npc_filter", 4.0, 12.0),
      rarityLabel: "全服",
      source: "runtime",
      unlockedAt: "2026-06-21T20:24:00+08:00",
    }],
    titles: ["NPC过滤器"],
    tags: ["NPC过滤器"],
    taskHistory: [
      { category: "npc_noise_reduction", completed: true },
      { category: "npc_noise_reduction", completed: true },
      { category: "npc_noise_reduction", completed: true },
      { category: "npc_noise_reduction", completed: true },
    ],
  };

  const next = unlockRuntimeAchievements(save, "2026-06-21T20:25:00+08:00");

  assert.equal(next.achievements.filter((item) => item.id === "npc_filter").length, 1);
  assert.equal(next.titles.filter((title) => title === "NPC过滤器").length, 1);
  assert.equal(next.tags.filter((tag) => tag === "NPC过滤器").length, 1);
  assert.equal(next.achievements[0].unlockedAt, "2026-06-21T20:24:00+08:00");
});
