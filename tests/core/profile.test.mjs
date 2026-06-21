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
