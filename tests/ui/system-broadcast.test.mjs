import test from "node:test";
import assert from "node:assert/strict";
import {
  getSystemBroadcastMarkup,
  renderSystemBroadcast,
} from "../../src/ui/system-broadcast.mjs";

test("first connection names the player, truthful city anchor and optional quest", () => {
  const markup = getSystemBroadcastMarkup({
    type: "first_connection",
    content: {
      playerName: "远行者",
      location: "中国 · 广东 · 深圳",
      questName: "完成 Earth Online",
    },
    actions: [{ id: "continue", label: "进入地球" }],
  });

  assert.match(markup, /地球已找到 远行者/);
  assert.match(markup, /玩家信号已在 中国 · 广东 · 深圳 建立/);
  assert.match(markup, /当前主线：完成 Earth Online/);
  assert.match(markup, /data-broadcast-type="first_connection"/);
  assert.equal((markup.match(/data-broadcast-action=/g) || []).length, 1);
});

test("normal return is one unframed broadcast with one deliberate action", () => {
  const markup = getSystemBroadcastMarkup({
    type: "normal_return",
    content: {
      playerName: "远行者",
      connectionDistance: { status: "known", text: "2 小时" },
    },
    actions: [{ id: "continue", label: "继续运行" }],
  });

  assert.match(markup, /玩家 远行者，欢迎返回。/);
  assert.match(markup, /距离上次连接：2 小时/);
  assert.match(markup, /当前没有新的系统事件。/);
  assert.match(markup, /地球仍在正常运行。/);
  assert.equal((markup.match(/data-broadcast-action=/g) || []).length, 1);
  assert.doesNotMatch(markup, /panel|card|chat|bubble|dialog/i);
  assert.doesNotMatch(markup, /<section\b|<article\b|<nav\b/);
});

test("active quest broadcast exposes exactly the three approved actions", () => {
  const markup = getSystemBroadcastMarkup({
    type: "active_main_quest",
    content: {
      questName: "完成 Earth Online",
      lastProgressDistance: { status: "unknown", text: "时间未知" },
    },
    actions: [
      { id: "record_progress", label: "记录进度" },
      { id: "view_main_quest", label: "查看主线" },
      { id: "dismiss", label: "暂不处理" },
    ],
  });

  assert.match(markup, /当前主线仍在运行/);
  assert.match(markup, /「完成 Earth Online」/);
  assert.match(markup, /上次更新：时间未知/);
  assert.equal((markup.match(/data-broadcast-action=/g) || []).length, 3);
});

test("broadcast remains mounted until the player acts and cleanup removes its listener", () => {
  const root = createRoot();
  let actions = 0;
  const cleanup = renderSystemBroadcast(root, {
    broadcast: {
      type: "normal_return",
      content: {
        playerName: "远行者",
        connectionDistance: { status: "known", text: "2 小时" },
      },
      actions: [{ id: "continue", label: "继续运行" }],
    },
    onAction: () => { actions += 1; },
  });

  assert.equal(root.listeners.get("click").size, 1);
  assert.match(root.innerHTML, /继续运行/);
  assert.equal(actions, 0);

  cleanup();
  assert.equal(root.listeners.get("click").size, 0);
  assert.equal(root.classList.has("is-broadcast"), false);
});

function createRoot() {
  const classes = new Set();
  const listeners = new Map();

  return {
    innerHTML: "",
    listeners,
    classList: {
      add: (value) => classes.add(value),
      remove: (value) => classes.delete(value),
      has: (value) => classes.has(value),
    },
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(listener);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
  };
}
