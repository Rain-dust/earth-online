import test from "node:test";
import assert from "node:assert/strict";
import {
  buildMainQuestDialogView,
  handleQuestDialogKeydown,
} from "../../src/ui/main-quest-dialog.mjs";

test("empty quest dialog asks for only a quest and first action", () => {
  const view = buildMainQuestDialogView({ mainQuest: null });

  assert.equal(view.mode, "empty");
  assert.deepEqual(view.fields.map((field) => field.name), ["title", "firstAction"]);
  assert.deepEqual(view.actions, ["create", "close"]);
});

test("active quest dialog keeps management focused", () => {
  const view = buildMainQuestDialogView({
    mainQuest: {
      id: "quest-1",
      title: "完成 Earth Online v0.3",
      status: "active",
      currentAction: { text: "完成清晨面板" },
    },
  });

  assert.equal(view.mode, "active");
  assert.deepEqual(view.fields.map((field) => field.name), ["currentAction"]);
  assert.deepEqual(view.actions, ["saveAction", "pause", "complete", "switch", "abandon", "close"]);
  assert.equal(view.fields.some((field) => ["deadline", "priority", "estimate", "successStandard"].includes(field.name)), false);
});

test("quest dialog Escape closes only the dialog", () => {
  const calls = [];
  const handled = handleQuestDialogKeydown({
    key: "Escape",
    preventDefault: () => calls.push("prevent"),
    stopPropagation: () => calls.push("stop"),
  }, () => calls.push("close"));

  assert.equal(handled, true);
  assert.deepEqual(calls, ["prevent", "stop", "close"]);
});
