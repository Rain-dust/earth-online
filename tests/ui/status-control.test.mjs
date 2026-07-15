import test from "node:test";
import assert from "node:assert/strict";
import {
  getStatusControlMarkup,
  getStatusOptions,
  handleStatusControlKeydown,
} from "../../src/ui/status-control.mjs";

test("getStatusOptions exposes five recognizable vector icons", () => {
  assert.deepEqual(getStatusOptions().map(({ id, icon }) => [id, icon]), [
    ["stable_operation", "orbit"],
    ["high_load", "gauge"],
    ["low_energy", "battery-low"],
    ["lost_route", "compass"],
    ["main_quest_push", "route"],
  ]);
});

test("status markup exposes an accessible listbox and Chinese labels", () => {
  const markup = getStatusControlMarkup("high_load");

  assert.match(markup, /aria-haspopup="listbox"/);
  assert.match(markup, /role="listbox"/);
  assert.match(markup, /data-lucide="gauge"/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, />高负载</);
  assert.equal((markup.match(/role="option"/g) || []).length, 5);
});

test("status Escape closes only the status popover", () => {
  const calls = [];
  const handled = handleStatusControlKeydown({
    key: "Escape",
    preventDefault: () => calls.push("prevent"),
    stopPropagation: () => calls.push("stop"),
  }, (options) => calls.push(options));

  assert.equal(handled, true);
  assert.deepEqual(calls, ["prevent", "stop", { restoreFocus: true }]);
});
