import test from "node:test";
import assert from "node:assert/strict";
import {
  abandonMainQuest,
  completeMainQuest,
  createMainQuest,
  pauseMainQuest,
  resumeMainQuest,
  setMainQuestAction,
  switchMainQuest,
} from "../../src/core/main-quest.mjs";

const FIRST_AT = "2026-07-13T08:00:00.000Z";
const SECOND_AT = "2026-07-13T09:00:00.000Z";

test("createMainQuest requires one title and one first action", () => {
  const empty = { mainQuest: null, mainQuestArchive: [] };

  assert.throws(
    () => createMainQuest(empty, { title: "", firstAction: "第一步" }, FIRST_AT),
    /主线与第一步不能为空/,
  );
  assert.throws(
    () => createMainQuest(empty, { title: "完成 v0.3", firstAction: " " }, FIRST_AT),
    /主线与第一步不能为空/,
  );
});

test("createMainQuest creates one active quest with a deterministic injected id factory", () => {
  const save = { mainQuest: null, mainQuestArchive: [] };
  const next = createMainQuest(save, {
    title: "  完成 Earth Online v0.3  ",
    firstAction: "  完成数据迁移  ",
  }, FIRST_AT, { idFactory: (prefix) => `${prefix}-1` });

  assert.deepEqual(next.mainQuest, {
    id: "quest-1",
    title: "完成 Earth Online v0.3",
    status: "active",
    startedAt: FIRST_AT,
    currentAction: {
      id: "action-1",
      text: "完成数据迁移",
      createdAt: FIRST_AT,
    },
  });
  assert.equal(save.mainQuest, null);
});

test("createMainQuest refuses to create a second active quest", () => {
  const active = fixtureActiveSave();

  assert.throws(
    () => createMainQuest(active, {
      title: "第二条主线",
      firstAction: "第二个动作",
    }, SECOND_AT),
    /已存在活跃主线/,
  );
});

test("switchMainQuest archives the current quest and activates exactly one new quest", () => {
  const first = createMainQuest({ mainQuest: null, mainQuestArchive: [] }, {
    title: "完成 Earth Online v0.3",
    firstAction: "完成数据迁移",
  }, FIRST_AT, { idFactory: (prefix) => `${prefix}-1` });
  const second = switchMainQuest(first, {
    title: "准备作品集",
    firstAction: "选择三个作品",
  }, SECOND_AT, { idFactory: (prefix) => `${prefix}-2` });

  assert.equal(second.mainQuest.title, "准备作品集");
  assert.equal(second.mainQuest.status, "active");
  assert.equal(second.mainQuestArchive.length, 1);
  assert.equal(second.mainQuestArchive[0].status, "paused");
  assert.equal(second.mainQuestArchive[0].id, "quest-1");
});

test("pauseMainQuest and resumeMainQuest preserve history and one active quest", () => {
  const paused = pauseMainQuest(fixtureActiveSave(), SECOND_AT);

  assert.equal(paused.mainQuest, null);
  assert.equal(paused.mainQuestArchive[0].status, "paused");

  const withAnotherActive = createMainQuest(paused, {
    title: "准备作品集",
    firstAction: "选择三个作品",
  }, SECOND_AT, { idFactory: (prefix) => `${prefix}-2` });
  const resumed = resumeMainQuest(withAnotherActive, "quest-1", "2026-07-13T10:00:00.000Z");

  assert.equal(resumed.mainQuest.id, "quest-1");
  assert.equal(resumed.mainQuest.status, "active");
  assert.equal(resumed.mainQuestArchive.length, 1);
  assert.equal(resumed.mainQuestArchive[0].id, "quest-2");
  assert.equal(resumed.mainQuestArchive[0].status, "paused");
});

test("completeMainQuest archives once and appends one completion event", () => {
  const first = completeMainQuest(fixtureActiveSave(), SECOND_AT);
  const second = completeMainQuest(first, "2026-07-13T09:01:00.000Z");

  assert.equal(first.mainQuest, null);
  assert.equal(first.mainQuestArchive[0].status, "completed");
  assert.equal(first.mainQuestArchive[0].completedAt, SECOND_AT);
  assert.deepEqual(first.activityEvents, [{
    id: "quest-completed:quest-1",
    type: "quest_completed",
    localDate: "2026-07-13",
    at: SECOND_AT,
    questId: "quest-1",
    payload: { title: "完成 Earth Online v0.3" },
  }]);
  assert.equal(second, first);
});

test("abandonMainQuest archives without creating a completion event", () => {
  const next = abandonMainQuest(fixtureActiveSave(), SECOND_AT);

  assert.equal(next.mainQuest, null);
  assert.equal(next.mainQuestArchive[0].status, "abandoned");
  assert.equal(next.mainQuestArchive[0].abandonedAt, SECOND_AT);
  assert.deepEqual(next.activityEvents, []);
});

test("setMainQuestAction updates only the active action", () => {
  const save = fixtureActiveSave();
  const next = setMainQuestAction(
    save,
    "  完成主线模块测试  ",
    SECOND_AT,
    { idFactory: (prefix) => `${prefix}-next` },
  );

  assert.deepEqual(next.mainQuest.currentAction, {
    id: "action-next",
    text: "完成主线模块测试",
    createdAt: SECOND_AT,
  });
  assert.equal(save.mainQuest.currentAction.text, "完成数据迁移");
  assert.throws(() => setMainQuestAction(save, " ", SECOND_AT), /主线行动不能为空/);
});

function fixtureActiveSave() {
  return {
    mainQuest: {
      id: "quest-1",
      title: "完成 Earth Online v0.3",
      status: "active",
      startedAt: FIRST_AT,
      currentAction: {
        id: "action-1",
        text: "完成数据迁移",
        createdAt: FIRST_AT,
      },
    },
    mainQuestArchive: [],
    activityEvents: [],
  };
}
