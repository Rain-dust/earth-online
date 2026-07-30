import test from "node:test";
import assert from "node:assert/strict";
import {
  formatTimeDistance,
  resolveCurrentMainQuestLastActivityAt,
  resolveSystemBroadcast,
} from "../../src/core/system-broadcast-resolver.mjs";

const NOW = "2026-07-20T12:00:00.000Z";

test("current quest activity ignores events from other quests", () => {
  const save = {
    mainQuest: {
      id: "quest-current",
      title: "完成 Earth Online",
      status: "active",
      startedAt: "2026-07-18T08:00:00.000Z",
      currentAction: {
        id: "action-1",
        text: "实现 Broadcast",
        createdAt: "2026-07-19T08:00:00.000Z",
      },
    },
    activityEvents: [
      {
        id: "other-progress",
        type: "main_progress_added",
        questId: "quest-other",
        at: "2026-07-20T11:55:00.000Z",
      },
      {
        id: "current-progress",
        type: "main_progress_added",
        questId: "quest-current",
        at: "2026-07-20T09:30:00.000Z",
      },
    ],
  };

  assert.equal(
    resolveCurrentMainQuestLastActivityAt(save),
    "2026-07-20T09:30:00.000Z",
  );
});

test("current quest activity returns null when every timestamp is invalid", () => {
  assert.equal(resolveCurrentMainQuestLastActivityAt({
    mainQuest: {
      id: "quest-current",
      title: "完成 Earth Online",
      status: "active",
      startedAt: "not-a-date",
      updatedAt: "",
      currentAction: { createdAt: "also-invalid" },
    },
    activityEvents: [{
      type: "main_progress_added",
      questId: "quest-current",
      at: null,
    }],
  }), null);
});

test("time distance exposes known and unknown states without inventing values", () => {
  assert.deepEqual(formatTimeDistance("2026-07-20T09:30:00.000Z", NOW), {
    status: "known",
    text: "2 小时 30 分钟",
  });
  assert.deepEqual(formatTimeDistance("invalid", NOW), {
    status: "unknown",
    text: "时间未知",
  });
  assert.deepEqual(formatTimeDistance("2026-07-20T13:00:00.000Z", NOW), {
    status: "unknown",
    text: "时间未知",
  });
});

test("active main quest broadcast wins and returns stable action metadata only", () => {
  const broadcast = resolveSystemBroadcast({
    connection: { firstConnectedAt: "2026-07-18T08:00:00.000Z" },
    profile: { nickname: "远行者" },
    mainQuest: {
      id: "quest-current",
      title: "完成 Earth Online",
      status: "active",
      startedAt: "2026-07-20T08:00:00.000Z",
      currentAction: {
        id: "action-1",
        text: "实现 Broadcast",
        createdAt: "2026-07-20T09:30:00.000Z",
      },
    },
    activityEvents: [],
  }, {
    now: NOW,
    previousLastActiveAt: "2026-07-19T12:00:00.000Z",
  });

  assert.equal(broadcast.type, "active_main_quest");
  assert.equal(broadcast.priority, 100);
  assert.equal(broadcast.source, "main_quest");
  assert.equal(broadcast.content.questName, "完成 Earth Online");
  assert.equal(broadcast.content.lastProgressAt, "2026-07-20T09:30:00.000Z");
  assert.equal(broadcast.content.lastProgressDistance.status, "known");
  assert.deepEqual(broadcast.actions, [
    { id: "record_progress", label: "记录进度" },
    { id: "view_main_quest", label: "查看主线" },
    { id: "dismiss", label: "暂不处理" },
  ]);
  assert.equal(broadcast.actions.some((action) => "callback" in action), false);
});

test("normal return uses the preserved previous activity timestamp", () => {
  const broadcast = resolveSystemBroadcast({
    connection: { firstConnectedAt: "2026-07-18T08:00:00.000Z" },
    profile: { nickname: "远行者" },
    mainQuest: null,
    activityEvents: [],
  }, {
    now: NOW,
    previousLastActiveAt: "2026-07-19T09:45:00.000Z",
  });

  assert.equal(broadcast.type, "normal_return");
  assert.equal(broadcast.content.playerName, "远行者");
  assert.deepEqual(broadcast.content.connectionDistance, {
    status: "known",
    text: "1 天 2 小时",
  });
  assert.deepEqual(broadcast.actions, [
    { id: "continue", label: "继续运行" },
  ]);
});

test("missing firstConnectedAt produces a truthful first connection before an active quest", () => {
  const broadcast = resolveSystemBroadcast({
    connection: { firstConnectedAt: null },
    profile: {
      nickname: "远行者",
      location: {
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
        precision: "city",
        source: "manual",
        confirmedByUser: true,
        confirmedAt: "2026-07-18T10:00:00.000Z",
      },
    },
    mainQuest: {
      id: "quest-current",
      title: "完成 Earth Online",
      status: "active",
      startedAt: "2026-07-20T08:00:00.000Z",
    },
  }, { now: NOW });

  assert.equal(broadcast.type, "first_connection");
  assert.equal(broadcast.priority, 200);
  assert.equal(broadcast.content.playerName, "远行者");
  assert.equal(broadcast.content.location, "中国 · 广东 · 深圳");
  assert.equal(broadcast.content.questName, "完成 Earth Online");
  assert.deepEqual(broadcast.actions, [{ id: "continue", label: "进入地球" }]);
  assert.equal(broadcast.actions.some((action) => "callback" in action), false);
});
