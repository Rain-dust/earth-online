import test from "node:test";
import assert from "node:assert/strict";
import { appendActivityEvent } from "../../src/core/activity-log.mjs";

test("appendActivityEvent stores one immutable event per id", () => {
  const save = { activityEvents: [] };
  const event = {
    id: "2026-07-13:main",
    type: "main_action_synced",
    localDate: "2026-07-13",
    at: "2026-07-13T08:00:00.000Z",
    questId: "quest-1",
    payload: { text: "完成数据迁移" },
  };

  const first = appendActivityEvent(save, event);
  event.payload.text = "外部篡改";
  const second = appendActivityEvent(first, {
    ...event,
    payload: { text: "重复点击" },
  });

  assert.equal(first.activityEvents.length, 1);
  assert.equal(first.activityEvents[0].payload.text, "完成数据迁移");
  assert.equal(second.activityEvents.length, 1);
  assert.equal(second.activityEvents[0].payload.text, "完成数据迁移");
  assert.deepEqual(save.activityEvents, []);
});

test("appendActivityEvent ignores malformed events", () => {
  const save = { activityEvents: [] };

  assert.equal(appendActivityEvent(save, null), save);
  assert.equal(appendActivityEvent(save, { type: "missing_id" }), save);
});

test("appendActivityEvent repairs malformed event collections", () => {
  const save = { activityEvents: {} };
  const next = appendActivityEvent(save, {
    id: "event-1",
    type: "free_record_saved",
  });

  assert.equal(next.activityEvents.length, 1);
  assert.equal(next.activityEvents[0].id, "event-1");
});
