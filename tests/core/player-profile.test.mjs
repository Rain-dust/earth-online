import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyOnboarding,
  finalizePlayerOnboarding,
  normalizeOnboarding,
  recordOnboardingAnswer,
  skipOnboardingStep,
} from "../../src/core/player-profile.mjs";

const NOW = "2026-07-18T10:00:00.000Z";

test("P0 onboarding contains only name, required location, optional quest and completion", () => {
  let save = fixtureSave();
  assert.equal(save.onboarding.lastStep, "player_name");

  save = recordOnboardingAnswer(save, "player_name", "Rain", NOW);
  assert.equal(save.onboarding.lastStep, "location");

  save = recordOnboardingAnswer(save, "location", LOCATION, NOW);
  assert.equal(save.onboarding.lastStep, "main_quest");

  save = skipOnboardingStep(save, "main_quest");
  assert.equal(save.onboarding.lastStep, "complete");
  assert.throws(() => skipOnboardingStep(
    recordOnboardingAnswer(fixtureSave(), "player_name", "Rain", NOW),
    "location",
  ), /不能跳过/);
});

test("player name is required and limited to 16 characters in the domain", () => {
  assert.throws(
    () => recordOnboardingAnswer(fixtureSave(), "player_name", "   ", NOW),
    /玩家名称不能为空/,
  );
  assert.doesNotThrow(
    () => recordOnboardingAnswer(fixtureSave(), "player_name", "1234567890123456", NOW),
  );
  assert.throws(
    () => recordOnboardingAnswer(fixtureSave(), "player_name", "12345678901234567", NOW),
    /不能超过 16 个字符/,
  );
});

test("completed legacy profiles remain complete", () => {
  const normalized = normalizeOnboarding({
    version: 2,
    status: "in_progress",
    lastStep: "birthday",
    draft: { nickname: "旧玩家" },
  }, { hasProfile: true });

  assert.equal(normalized.status, "complete");
  assert.equal(normalized.lastStep, "complete");
});

test("interrupted v2 removed steps migrate to the next truthful P0 requirement", () => {
  const needsLocation = normalizeOnboarding({
    version: 2,
    status: "in_progress",
    completedSteps: ["player_name"],
    lastStep: "life_stage",
    draft: {
      nickname: "Rain",
      lifeStage: { value: "working", source: "user", updatedAt: NOW },
    },
  });
  assert.equal(needsLocation.lastStep, "location");
  assert.deepEqual(needsLocation.draft.lifeStage, {
    value: "working",
    source: "user",
    updatedAt: NOW,
  });

  const needsQuest = normalizeOnboarding({
    version: 2,
    status: "in_progress",
    completedSteps: ["player_name", "location", "life_stage", "birthday"],
    lastStep: "zodiac_confirm",
    draft: confirmedDraft(),
  });
  assert.equal(needsQuest.lastStep, "main_quest");

  const ready = normalizeOnboarding({
    version: 2,
    status: "in_progress",
    completedSteps: ["player_name", "location"],
    lastStep: "summary",
    draft: { ...confirmedDraft(), mainQuest: "完成 v0.4" },
  });
  assert.equal(ready.lastStep, "complete");
});

test("a legacy skipped location cannot bypass the new required city anchor", () => {
  const normalized = normalizeOnboarding({
    version: 2,
    status: "in_progress",
    completedSteps: ["player_name"],
    skippedSteps: ["location", "life_stage", "birthday", "mbti"],
    lastStep: "main_quest",
    draft: { nickname: "Rain", locationSetupStatus: "skipped" },
  });

  assert.equal(normalized.lastStep, "location");
});

test("finalization requires real confirmed coordinates and preserves optional v2 draft fields", () => {
  const save = {
    ...fixtureSave(),
    onboarding: {
      version: 2,
      status: "in_progress",
      completedSteps: [
        "player_name",
        "location",
        "life_stage",
        "birthday",
        "zodiac_confirm",
        "mbti",
        "main_quest",
      ],
      skippedSteps: [],
      lastStep: "summary",
      draft: {
        ...confirmedDraft(),
        mainQuest: "完成 Earth Online v0.4",
      },
    },
  };

  const completed = finalizePlayerOnboarding(save, NOW, {
    idFactory: (prefix) => `${prefix}-profile`,
  });

  assert.equal(completed.profile.nickname, "Rain");
  assert.equal(completed.profile.location.cityDisplayName, "深圳");
  assert.equal(completed.profile.location.latitude, 22.5431);
  assert.deepEqual(completed.profile.lifeStage, {
    value: "working",
    source: "user",
    updatedAt: NOW,
  });
  assert.equal(completed.profile.birthday.year, 2007);
  assert.equal(completed.profile.zodiac.value, "aries");
  assert.equal(completed.profile.mbti.value, "INTP");
  assert.equal(completed.mainQuest.title, "完成 Earth Online v0.4");
  assert.equal(completed.onboarding.status, "complete");
  assert.equal(completed.onboarding.lastStep, "complete");
  assert.deepEqual(completed.onboarding.draft, {});
});

test("finalization rejects a fabricated or missing location", () => {
  const save = {
    ...fixtureSave(),
    onboarding: {
      version: 2,
      status: "in_progress",
      completedSteps: ["player_name", "main_quest"],
      skippedSteps: ["main_quest"],
      lastStep: "complete",
      draft: { nickname: "Rain" },
    },
  };

  assert.throws(
    () => finalizePlayerOnboarding(save, NOW),
    /请选择城市并确认位置锚点|建档尚未完成必要信息/,
  );
});

function confirmedDraft() {
  return {
    nickname: "Rain",
    locationSetupStatus: "confirmed",
    location: {
      ...LOCATION,
      precision: "city",
      source: "manual",
      confirmedByUser: true,
      confirmedAt: NOW,
    },
    lifeStage: { value: "working", source: "user", updatedAt: NOW },
    birthday: {
      year: 2007,
      month: 4,
      day: 10,
      yearIsPrivate: false,
      source: "user",
    },
    zodiac: {
      value: "aries",
      source: "derived_from_birthday",
      confirmedByUser: true,
    },
    mbti: {
      value: "INTP",
      source: "user",
      confidence: "self_reported",
    },
  };
}

function fixtureSave() {
  return {
    profile: null,
    onboarding: createEmptyOnboarding(),
    mainQuest: null,
    mainQuestArchive: [],
    achievements: [],
    achievementArchive: { scanStatus: "pending", candidateIds: [] },
    activityEvents: [],
    dailyRuns: [],
    titles: [],
    tags: [],
  };
}

const LOCATION = {
  id: "simplemaps:1566922272",
  countryCode: "CN",
  countryName: "China",
  countryDisplayName: "中国",
  regionCode: null,
  regionName: "Guangdong",
  regionDisplayName: "广东",
  cityName: "Shenzhen",
  cityDisplayName: "深圳",
  asciiName: "Shenzhen",
  latitude: 22.5431,
  longitude: 114.0579,
  population: 17_600_000,
  capitalType: "admin",
};
