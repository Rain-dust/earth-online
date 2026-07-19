import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyOnboarding,
  deriveZodiac,
  finalizePlayerOnboarding,
  getZodiacLabel,
  normalizeMbti,
  normalizeOnboarding,
  parseBirthday,
  recordOnboardingAnswer,
  skipOnboardingStep,
} from "../../src/core/player-profile.mjs";

const NOW = "2026-07-18T10:00:00.000Z";

test("empty onboarding starts at the required player name", () => {
  assert.deepEqual(createEmptyOnboarding(), {
    version: 1,
    status: "not_started",
    completedSteps: [],
    skippedSteps: [],
    lastStep: "player_name",
    draft: {},
  });
});

test("legacy profiles normalize as completed onboarding", () => {
  const normalized = normalizeOnboarding(undefined, { hasProfile: true });

  assert.equal(normalized.status, "complete");
  assert.equal(normalized.lastStep, "complete");
  assert.deepEqual(normalized.draft, {});
});

test("birthday parsing accepts a full date or private year and rejects invalid dates", () => {
  assert.deepEqual(parseBirthday("2007-04-10"), {
    year: 2007,
    month: 4,
    day: 10,
    yearIsPrivate: false,
  });
  assert.deepEqual(parseBirthday("04-10"), {
    year: null,
    month: 4,
    day: 10,
    yearIsPrivate: true,
  });
  assert.deepEqual(parseBirthday("2000-02-29"), {
    year: 2000,
    month: 2,
    day: 29,
    yearIsPrivate: false,
  });
  assert.equal(parseBirthday("2023-02-29"), null);
  assert.equal(parseBirthday("13-40"), null);
});

test("zodiac derivation respects boundary dates", () => {
  assert.equal(deriveZodiac(3, 20), "pisces");
  assert.equal(deriveZodiac(3, 21), "aries");
  assert.equal(deriveZodiac(4, 19), "aries");
  assert.equal(deriveZodiac(4, 20), "taurus");
  assert.equal(deriveZodiac(12, 22), "capricorn");
  assert.equal(deriveZodiac(1, 19), "capricorn");
  assert.equal(deriveZodiac(1, 20), "aquarius");
  assert.equal(getZodiacLabel("aries"), "白羊座");
});

test("MBTI normalization accepts only the sixteen self-reported types", () => {
  assert.equal(normalizeMbti(" intp "), "INTP");
  assert.equal(normalizeMbti("ENFJ"), "ENFJ");
  assert.equal(normalizeMbti("AAAA"), null);
  assert.equal(normalizeMbti(""), null);
});

test("recording the player name persists the next resumable step", () => {
  const save = fixtureSave();
  const next = recordOnboardingAnswer(save, "player_name", "  Rain-dust  ", NOW);

  assert.equal(next.profile, null);
  assert.equal(next.onboarding.status, "in_progress");
  assert.equal(next.onboarding.draft.nickname, "Rain-dust");
  assert.deepEqual(next.onboarding.completedSteps, ["player_name"]);
  assert.equal(next.onboarding.lastStep, "life_stage");
  assert.throws(
    () => recordOnboardingAnswer(save, "player_name", "   ", NOW),
    /玩家名称不能为空/,
  );
});

test("skipping birthday also skips its derived zodiac confirmation", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Rain", NOW);
  save = skipOnboardingStep(save, "life_stage", NOW);
  save = skipOnboardingStep(save, "birthday", NOW);

  assert.deepEqual(save.onboarding.skippedSteps, ["life_stage", "birthday", "zodiac_confirm"]);
  assert.equal(save.onboarding.lastStep, "mbti");
  assert.equal(save.onboarding.draft.birthday, undefined);
  assert.equal(save.onboarding.draft.zodiac, undefined);
});

test("birthday derives a zodiac that the player can confirm or replace", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Rain", NOW);
  save = skipOnboardingStep(save, "life_stage", NOW);
  save = recordOnboardingAnswer(save, "birthday", "04-10", NOW);

  assert.equal(save.onboarding.draft.zodiac.value, "aries");
  assert.equal(save.onboarding.draft.zodiac.source, "derived_from_birthday");
  assert.equal(save.onboarding.draft.zodiac.confirmedByUser, false);
  assert.equal(save.onboarding.lastStep, "zodiac_confirm");

  const confirmed = recordOnboardingAnswer(save, "zodiac_confirm", true, NOW);
  assert.equal(confirmed.onboarding.draft.zodiac.confirmedByUser, true);
  assert.equal(confirmed.onboarding.lastStep, "mbti");

  const manuallyChanged = recordOnboardingAnswer(save, "zodiac_confirm", "taurus", NOW);
  assert.deepEqual(manuallyChanged.onboarding.draft.zodiac, {
    value: "taurus",
    source: "user",
    confirmedByUser: true,
  });
});

test("malformed persisted onboarding state is normalized without keeping unsafe drafts", () => {
  const normalized = normalizeOnboarding({
    status: "future",
    completedSteps: ["player_name", "player_name", "unknown", 4],
    skippedSteps: "invalid",
    lastStep: "unknown",
    draft: [],
  });

  assert.equal(normalized.status, "in_progress");
  assert.deepEqual(normalized.completedSteps, ["player_name"]);
  assert.deepEqual(normalized.skippedSteps, []);
  assert.equal(normalized.lastStep, "life_stage");
  assert.deepEqual(normalized.draft, {});
});

test("finalization writes sourced profile fields and preserves existing save collections", () => {
  const original = fixtureSave();
  let save = recordOnboardingAnswer(original, "player_name", "Rain-dust", NOW);
  save = recordOnboardingAnswer(save, "life_stage", "working", NOW);
  save = recordOnboardingAnswer(save, "birthday", "2007-04-10", NOW);
  save = recordOnboardingAnswer(save, "zodiac_confirm", true, NOW);
  save = recordOnboardingAnswer(save, "mbti", "intp", NOW);
  save = recordOnboardingAnswer(save, "main_quest", "完成 Earth Online v0.4", NOW);

  const completed = finalizePlayerOnboarding(save, NOW, {
    idFactory: (prefix) => `${prefix}-profile`,
  });

  assert.deepEqual(completed.profile, {
    nickname: "Rain-dust",
    createdAt: NOW,
    lifeStage: {
      value: "working",
      source: "user",
      updatedAt: NOW,
    },
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
  });
  assert.equal(completed.onboarding.status, "complete");
  assert.equal(completed.onboarding.lastStep, "complete");
  assert.deepEqual(completed.onboarding.draft, {});
  assert.equal(completed.mainQuest.title, "完成 Earth Online v0.4");
  assert.equal(completed.mainQuest.currentAction.text, "完成 Earth Online v0.4");
  assert.strictEqual(completed.achievements, original.achievements);
  assert.strictEqual(completed.activityEvents, original.activityEvents);
  assert.strictEqual(completed.dailyRuns, original.dailyRuns);
  assert.deepEqual(completed.achievementArchive, original.achievementArchive);
});

test("a nearly blank profile can finish without rewards, tags, or a main quest", () => {
  let save = recordOnboardingAnswer(fixtureSave(), "player_name", "Minimal", NOW);
  save = skipOnboardingStep(save, "life_stage", NOW);
  save = skipOnboardingStep(save, "birthday", NOW);
  save = skipOnboardingStep(save, "mbti", NOW);
  save = skipOnboardingStep(save, "main_quest", NOW);

  const completed = finalizePlayerOnboarding(save, NOW);

  assert.deepEqual(completed.profile, { nickname: "Minimal", createdAt: NOW });
  assert.equal(completed.mainQuest, null);
  assert.deepEqual(completed.achievements, []);
  assert.deepEqual(completed.titles, []);
  assert.deepEqual(completed.tags, []);
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
