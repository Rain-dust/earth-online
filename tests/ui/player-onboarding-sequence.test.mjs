import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createEmptyOnboarding,
  recordOnboardingAnswer,
  skipOnboardingStep,
} from "../../src/core/player-profile.mjs";
import {
  getOnboardingSummary,
  getPlayerOnboardingMarkup,
} from "../../src/ui/player-onboarding-sequence.mjs";

const NOW = "2026-07-18T10:00:00.000Z";

test("every active onboarding step renders exactly one unframed question", () => {
  for (const save of buildStepFixtures()) {
    const markup = getPlayerOnboardingMarkup(save);

    assert.equal((markup.match(/data-onboarding-question/g) || []).length, 1);
    assert.doesNotMatch(markup, /class="[^"]*(panel|card|chat|bubble|progress|terminal)/i);
    assert.doesNotMatch(markup, /<section\b|<article\b/);
  }
});

test("the required player name has no skip control", () => {
  const markup = getPlayerOnboardingMarkup(fixtureSave());

  assert.match(markup, /玩家名称/);
  assert.match(markup, /name="playerName"/);
  assert.doesNotMatch(markup, /data-action="skip"/);
});

test("optional questions expose a quiet skip control", () => {
  const optionalSaves = buildStepFixtures().slice(1);

  for (const save of optionalSaves) {
    const markup = getPlayerOnboardingMarkup(save);
    assert.match(markup, /data-action="skip"/);
  }
});

test("birthday and zodiac steps make the date contract and derived label visible", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Rain", NOW);
  save = skipOnboardingStep(save, "life_stage", NOW);
  const birthdayMarkup = getPlayerOnboardingMarkup(save);

  assert.match(birthdayMarkup, /YYYY-MM-DD/);
  assert.match(birthdayMarkup, /MM-DD/);

  save = recordOnboardingAnswer(save, "birthday", "04-10", NOW);
  const zodiacMarkup = getPlayerOnboardingMarkup(save);

  assert.match(zodiacMarkup, /白羊座/);
  assert.match(zodiacMarkup, /data-action="confirm-zodiac"/);
  assert.match(zodiacMarkup, /name="zodiac"/);
});

test("MBTI copy states that the value is self-reported", () => {
  const save = buildStepFixtures().find((item) => item.onboarding.lastStep === "mbti");
  const markup = getPlayerOnboardingMarkup(save);

  assert.match(markup, /由你自行提交/);
  assert.match(markup, /尚未确定/);
  assert.doesNotMatch(markup, /推断|检测人格|分析人格/);
});

test("summary counts restored identity fields separately from the main quest", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Rain", NOW);
  save = recordOnboardingAnswer(save, "life_stage", "working", NOW);
  save = recordOnboardingAnswer(save, "birthday", "2007-04-10", NOW);
  save = recordOnboardingAnswer(save, "zodiac_confirm", true, NOW);
  save = recordOnboardingAnswer(save, "mbti", "INTP", NOW);
  save = recordOnboardingAnswer(save, "main_quest", "完成 v0.4", NOW);

  assert.deepEqual(getOnboardingSummary(save), {
    identityCount: 5,
    questCount: 1,
    historyCount: 0,
  });

  const markup = getPlayerOnboardingMarkup(save);
  assert.match(markup, /已恢复身份信息：5/);
  assert.match(markup, /当前主线：1/);
  assert.match(markup, /历史记录：0/);
  assert.match(markup, /data-action="complete"/);
});

test("a nearly blank summary remains valid and concise", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Minimal", NOW);
  save = skipOnboardingStep(save, "life_stage", NOW);
  save = skipOnboardingStep(save, "birthday", NOW);
  save = skipOnboardingStep(save, "mbti", NOW);
  save = skipOnboardingStep(save, "main_quest", NOW);

  assert.deepEqual(getOnboardingSummary(save), {
    identityCount: 1,
    questCount: 0,
    historyCount: 0,
  });
  assert.equal((getPlayerOnboardingMarkup(save).match(/data-onboarding-question/g) || []).length, 1);
});

test("validation messages are escaped before rendering", () => {
  const markup = getPlayerOnboardingMarkup(fixtureSave(), {
    error: '<img src=x onerror="alert(1)">',
  });

  assert.doesNotMatch(markup, /<img/);
  assert.match(markup, /&lt;img/);
});

test("onboarding presentation stays unframed with underline inputs and text commands", async () => {
  const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /#system-root\.is-connection[\s\S]*background:\s*transparent;/);
  assert.match(styles, /\.earth-connection-signal\s*\{[^}]*position:\s*absolute;/s);
  assert.match(styles, /\.onboarding-entry input,[\s\S]*\.onboarding-entry select\s*\{[^}]*border-radius:\s*0;[^}]*border-bottom:/s);
  assert.match(styles, /\.onboarding-options button\s*\{[^}]*border:\s*0;[^}]*background:\s*transparent;/s);
});

function buildStepFixtures() {
  const fixtures = [];
  let save = fixtureSave();
  fixtures.push(save);
  save = recordOnboardingAnswer(save, "player_name", "Rain", NOW);
  fixtures.push(save);
  save = skipOnboardingStep(save, "life_stage", NOW);
  fixtures.push(save);
  save = recordOnboardingAnswer(save, "birthday", "04-10", NOW);
  fixtures.push(save);
  save = recordOnboardingAnswer(save, "zodiac_confirm", true, NOW);
  fixtures.push(save);
  save = recordOnboardingAnswer(save, "mbti", "INTP", NOW);
  fixtures.push(save);
  return fixtures;
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
