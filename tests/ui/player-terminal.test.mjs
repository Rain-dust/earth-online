import test from "node:test";
import assert from "node:assert/strict";
import {
  getPlayerTerminalMarkup,
  getTaskSyncTerminalMarkup,
} from "../../src/ui/player-terminal.mjs";

test("player terminal is a Chinese-first executable window with seven scan tracks", () => {
  const markup = getPlayerTerminalMarkup({
    playerName: "远行者",
    currentStatus: "stable_operation",
    attributes: [
      ["vitality", "体力", "VITALITY", 65],
      ["energy", "精力", "ENERGY", 60],
      ["focus", "专注", "FOCUS", 55],
      ["mood", "心境", "MOOD", 60],
      ["order", "秩序", "ORDER", 50],
      ["connection", "连接", "CONNECTION", 50],
      ["exploration", "探索", "EXPLORATION", 50],
    ].map(([id, label, english, value]) => ({ id, label, english, value })),
    activeEffects: [],
  });

  assert.match(markup, /C:\\EarthOnline\\Players\\远行者/);
  assert.match(markup, /player@earth/);
  assert.match(markup, /远行者-profile\.exe/);
  assert.equal((markup.match(/class="terminal-attribute"/g) || []).length, 7);
  assert.doesNotMatch(markup, /<img\b|avatar/i);
});

test("task sync terminal reports exact value transitions and effect copy", () => {
  const markup = getTaskSyncTerminalMarkup({
    attributeChanges: [{ label: "专注", before: 55, after: 58 }],
    baseChanges: [],
    effect: {
      name: "沉浸",
      description: "期间专注小幅提升。",
    },
  });

  assert.match(markup, /task-sync\.exe/);
  assert.match(markup, /专注 55 → 58/);
  assert.match(markup, /玩家激活【沉浸】状态，持续45min/);
});
