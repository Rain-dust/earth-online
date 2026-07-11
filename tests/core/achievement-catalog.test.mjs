import test from "node:test";
import assert from "node:assert/strict";
import {
  ACHIEVEMENT_CATALOG,
  ACHIEVEMENT_CATALOG_VERSION,
  getAchievementDefinition,
  getRarityTier,
} from "../../src/core/achievement-catalog.mjs";

const EXPECTED_ACHIEVEMENTS = [
  ["academic-complete", "学有所成", 38],
  ["driver-license-hunter", "驾照猎人", 53],
  ["cooking-awakened", "厨艺觉醒", 62],
  ["first-love", "初恋支线", 71],
  ["first-job", "第一份工", 71],
  ["overseas-checkin", "海外打卡", 11],
  ["true-bond", "真心羁绊", 13],
  ["self-rescue", "自我救赎", 67],
  ["keep-passion", "守住热爱", 13],
  ["wilderness-camp", "山野露营", 10.3],
  ["financial-freedom", "财富自由", 5.2],
  ["paid-home", "全款置业", 4],
];

test("v0.2 catalog contains 12 unique fixed-rate achievements", () => {
  assert.equal(ACHIEVEMENT_CATALOG_VERSION, 2);
  assert.equal(ACHIEVEMENT_CATALOG.length, 12);
  assert.equal(new Set(ACHIEVEMENT_CATALOG.map((item) => item.id)).size, 12);
  assert.deepEqual(
    ACHIEVEMENT_CATALOG.map(({ id, title, rarityPercent }) => [id, title, rarityPercent]),
    EXPECTED_ACHIEVEMENTS,
  );
  assert.equal(getAchievementDefinition("paid-home").rarityPercent, 4);
  assert.equal(getAchievementDefinition("driver-license-hunter").rarityPercent, 53);
});

test("catalog definitions expose immutable metadata and strong old-save signals", () => {
  assert.equal(Object.isFrozen(ACHIEVEMENT_CATALOG), true);

  for (const definition of ACHIEVEMENT_CATALOG) {
    assert.equal(typeof definition.description, "string");
    assert.notEqual(definition.description.trim(), "");
    assert.equal(typeof definition.category, "string");
    assert.notEqual(definition.category.trim(), "");
    assert.equal(definition.iconAsset, `./assets/achievements/${definition.id}.png`);
    assert.equal(Object.isFrozen(definition), true);
    assert.equal(Object.isFrozen(definition.oldSaveSignals), true);
  }

  assert.deepEqual(getAchievementDefinition("academic-complete").oldSaveSignals, [
    "education_undergraduate",
    "education_graduate",
  ]);
  assert.deepEqual(getAchievementDefinition("first-job").oldSaveSignals, [
    "stage_working",
    "stage_freelancing",
  ]);
  assert.deepEqual(getAchievementDefinition("self-rescue").oldSaveSignals, [
    "setback_recovered",
    "setback_repeated_recovery",
  ]);

  const strongSignalIds = new Set(["academic-complete", "first-job", "self-rescue"]);
  for (const definition of ACHIEVEMENT_CATALOG) {
    if (!strongSignalIds.has(definition.id)) {
      assert.deepEqual(definition.oldSaveSignals, []);
    }
  }
});

test("getAchievementDefinition returns a definition or null", () => {
  assert.equal(getAchievementDefinition("true-bond"), ACHIEVEMENT_CATALOG[6]);
  assert.equal(getAchievementDefinition("not-an-achievement"), null);
});

test("rarity tiers follow the exact approved boundaries", () => {
  assert.deepEqual(getRarityTier(0.999), { id: "world_record", label: "世界级记录" });
  assert.deepEqual(getRarityTier(1), { id: "ultra_rare", label: "极稀有记录" });
  assert.deepEqual(getRarityTier(4.999), { id: "ultra_rare", label: "极稀有记录" });
  assert.deepEqual(getRarityTier(5), { id: "rare", label: "稀有记录" });
  assert.deepEqual(getRarityTier(19.999), { id: "rare", label: "稀有记录" });
  assert.deepEqual(getRarityTier(20), { id: "precious", label: "珍贵记录" });
  assert.deepEqual(getRarityTier(49.999), { id: "precious", label: "珍贵记录" });
  assert.deepEqual(getRarityTier(50), { id: "common", label: "常见记录" });
});
