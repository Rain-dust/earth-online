import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createEmptyOnboarding,
  recordOnboardingAnswer,
} from "../../src/core/player-profile.mjs";
import {
  getOnboardingFeedbackMessage,
  getOnboardingSummary,
  getPlayerOnboardingMarkup,
} from "../../src/ui/player-onboarding-sequence.mjs";

const NOW = "2026-07-18T10:00:00.000Z";

test("first run renders only name, required location and optional main quest", () => {
  let save = fixtureSave();
  const nameMarkup = getPlayerOnboardingMarkup(save);
  assert.match(nameMarkup, /玩家名称/);
  assert.match(nameMarkup, /maxlength="16"/);
  assert.doesNotMatch(nameMarkup, /data-action="skip"/);

  save = recordOnboardingAnswer(save, "player_name", "Rain", NOW);
  const locationMarkup = getPlayerOnboardingMarkup(save);
  assert.match(locationMarkup, /选择一座城市建立玩家信号锚点/);
  assert.match(locationMarkup, /data-action="choose-location"/);
  assert.doesNotMatch(locationMarkup, /data-action="skip"/);

  save = recordOnboardingAnswer(save, "location", LOCATION, NOW);
  const questMarkup = getPlayerOnboardingMarkup(save);
  assert.match(questMarkup, /当前主线/);
  assert.match(questMarkup, /data-step="main_quest"/);

  for (const markup of [nameMarkup, locationMarkup, questMarkup]) {
    assert.equal((markup.match(/data-onboarding-question/g) || []).length, 1);
    assert.doesNotMatch(markup, /life_stage|birthday|zodiac|mbti|summary/i);
    assert.doesNotMatch(markup, /class="[^"]*(panel|card|progress|hud)/i);
    assert.doesNotMatch(markup, /<section\b|<article\b/);
  }
});

test("summary UI and completion controls are absent", () => {
  const sourceSave = {
    ...fixtureSave(),
    onboarding: {
      version: 2,
      status: "in_progress",
      completedSteps: ["player_name", "location", "main_quest"],
      skippedSteps: [],
      lastStep: "summary",
      draft: {
        nickname: "Rain",
        locationSetupStatus: "confirmed",
        location: confirmedLocation(),
        mainQuest: "完成 v0.4",
      },
    },
  };

  const markup = getPlayerOnboardingMarkup(sourceSave);
  assert.doesNotMatch(markup, /建档摘要|历史记录|data-action="complete"/);
});

test("legacy optional draft fields remain visible to the compatibility summary API only", () => {
  const save = {
    ...fixtureSave(),
    onboarding: {
      version: 2,
      status: "in_progress",
      completedSteps: ["player_name", "location"],
      skippedSteps: [],
      lastStep: "birthday",
      draft: {
        nickname: "Rain",
        locationSetupStatus: "confirmed",
        location: confirmedLocation(),
        lifeStage: { value: "working", source: "user", updatedAt: NOW },
        birthday: { year: 2007, month: 4, day: 10, yearIsPrivate: false, source: "user" },
        zodiac: { value: "aries", source: "derived_from_birthday", confirmedByUser: true },
        mbti: { value: "INTP", source: "user", confidence: "self_reported" },
      },
    },
  };

  assert.deepEqual(getOnboardingSummary(save), {
    identityCount: 5,
    questCount: 0,
    historyCount: 0,
  });
  assert.match(getPlayerOnboardingMarkup(save), /当前主线/);
});

test("feedback reflects persisted name and selected city", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Rain", NOW);
  assert.equal(getOnboardingFeedbackMessage("player_name", save), "玩家 Rain 已确认。");

  save = recordOnboardingAnswer(save, "location", LOCATION, NOW);
  assert.equal(
    getOnboardingFeedbackMessage("location", save),
    "玩家位置锚点已建立。\n中国 · 广东 · 深圳",
  );
});

test("last answer and skip use direct finalize callback flow without timers", async () => {
  const source = await readFile(
    new URL("../../src/ui/player-onboarding-sequence.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /await onSave\(nextSave\)/);
  assert.match(source, /await complete\(\)/);
  assert.match(source, /onComplete\(currentSave\)/);
  assert.doesNotMatch(source, /setTimeout|setInterval|data-action=['"]complete|onboarding-summary/);
  assert.match(source, /renderLocationSelector/);
});

test("validation messages are escaped before rendering", () => {
  const markup = getPlayerOnboardingMarkup(fixtureSave(), {
    error: '<img src=x onerror="alert(1)">',
  });

  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /&lt;img/);
});

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

function confirmedLocation() {
  return {
    ...LOCATION,
    precision: "city",
    source: "manual",
    confirmedByUser: true,
    confirmedAt: NOW,
  };
}

const LOCATION = {
  id: "cn-shenzhen",
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
