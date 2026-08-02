import test from "node:test";
import assert from "node:assert/strict";

import {
  LINK_START_ACHIEVEMENT,
  buildFirstDaySequenceView,
  getFirstDaySequenceTimeline,
} from "../../src/core/first-day-sequence.mjs";

const DATE = "2026-07-30";

test("first-day view delivers the daily mission even when a main quest exists", () => {
  const view = buildFirstDaySequenceView({
    profile: {
      nickname: "Rain",
      location: { city: "Shenzhen", latitude: 22.54, longitude: 114.06 },
    },
    mainQuest: { title: "Ship Earth Online" },
    dailyRuns: [{
      date: DATE,
      mainAction: {
        questId: "quest-1",
        actionId: "action-1",
        text: "Complete the first signal",
      },
      maintenance: {
        itemId: "maintenance-1",
        title: "Take a short walk",
      },
    }],
  }, DATE);

  assert.equal(view.playerName, "Rain");
  assert.equal(view.task.type, "maintenance");
  assert.equal(view.task.id, "maintenance-1");
  assert.equal(view.task.title, "Take a short walk");
  assert.equal(view.task.source, "地球 Online 每日任务");
});

test("first-day view uses the real maintenance item when no main action exists", () => {
  const view = buildFirstDaySequenceView({
    profile: { nickname: "Rain", location: { city: "Shenzhen" } },
    dailyRuns: [{
      date: DATE,
      mainAction: null,
      maintenance: {
        itemId: "maintenance-1",
        title: "Take a short walk",
      },
    }],
  }, DATE);

  assert.equal(view.task.type, "maintenance");
  assert.equal(view.task.id, "maintenance-1");
  assert.equal(view.task.title, "Take a short walk");
});

test("missing recoverable task fields degrade to one explicit safe task", () => {
  const view = buildFirstDaySequenceView({
    profile: { nickname: "Rain", location: { city: "Shenzhen" } },
    dailyRuns: [],
  }, DATE);

  assert.equal(view.task.type, "fallback");
  assert.equal(typeof view.task.title, "string");
  assert.ok(view.task.title.length > 0);
});

test("LINK START is a fixed first-connection proof without progression fields", () => {
  assert.equal(LINK_START_ACHIEVEMENT.id, "link-start");
  assert.equal(LINK_START_ACHIEVEMENT.title, "LINK START!");
  assert.equal(LINK_START_ACHIEVEMENT.rarityPercent, 100);
  assert.match(LINK_START_ACHIEVEMENT.imageAsset, /link-start\.png$/);
  assert.equal("level" in LINK_START_ACHIEVEMENT, false);
  assert.equal("exp" in LINK_START_ACHIEVEMENT, false);
  assert.equal("titleReward" in LINK_START_ACHIEVEMENT, false);
  assert.equal("tags" in LINK_START_ACHIEVEMENT, false);
});

test("normal and reduced-motion timelines preserve the achievement beat", () => {
  const normal = getFirstDaySequenceTimeline(false);
  const reduced = getFirstDaySequenceTimeline(true);

  assert.deepEqual(normal.map((stage) => stage.phase), [
    "unlocking",
    "revealed",
    "leaving",
    "task-ping",
    "task-live",
  ]);
  assert.deepEqual(reduced.map((stage) => stage.phase), normal.map((stage) => stage.phase));
  assert.ok(normal[2].at - normal[1].at >= 2500);
  assert.ok(reduced[2].at - reduced[1].at >= 1500);
  assert.ok(normal[4].at > normal[3].at);
  assert.ok(reduced[4].at > reduced[3].at);
});
