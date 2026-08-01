import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CONNECTION_ROUTES,
  getConnectionSignalInterval,
  getConnectionSignalMarkup,
  getConnectionRoute,
  renderEarthConnectionSequence,
} from "../../src/ui/earth-connection-sequence.mjs";

test("reduced motion removes flourish without collapsing the connection into flashes", () => {
  assert.equal(getConnectionSignalInterval(false), 520);
  assert.ok(getConnectionSignalInterval(true) >= 400);
});

test("connection route recognizes a returning legacy player", () => {
  assert.equal(getConnectionRoute({
    profile: { nickname: "远行者" },
  }), CONNECTION_ROUTES.RETURNING_PLAYER);
});

test("connection route keeps empty and interrupted saves on the new-player path", () => {
  assert.equal(getConnectionRoute({ profile: null }), CONNECTION_ROUTES.NEW_PLAYER);
  assert.equal(getConnectionRoute({
    profile: null,
    onboarding: { status: "in_progress", lastStep: "birthday" },
  }), CONNECTION_ROUTES.NEW_PLAYER);
});

test("connection signals describe real operations and remain unframed", () => {
  const signals = [
    { id: "reading_save", text: "正在读取本地存档……" },
    { id: "save_found", text: "本地存档已找到。" },
    { id: "player_identified", text: "玩家 远行者 已确认。" },
    { id: "broadcast_resolved", text: "发现 1 条未处理事件。" },
  ];

  for (const signal of signals) {
    const markup = getConnectionSignalMarkup(signal);
    assert.equal((markup.match(/<p\b/g) || []).length, 1);
    assert.doesNotMatch(markup, /panel|card|chat|bubble|progress/i);
    assert.doesNotMatch(markup, /正在同步地球坐标|正在恢复你的运行轨道/);
    assert.doesNotMatch(markup, /<section\b|<article\b/);
  }
});

test("connection presenter starts with a real read signal and shows explicit errors", () => {
  const root = createRoot();
  const presenter = renderEarthConnectionSequence(root, {
    schedule: () => null,
    cancel: () => {},
  });

  assert.match(root.innerHTML, /正在读取本地存档/);
  presenter.show({
    id: "read_error",
    tone: "error",
    text: "本地存档读取失败：storage denied",
    actions: [
      { id: "retry", label: "重试" },
      { id: "return_home", label: "返回首页" },
    ],
  });
  assert.match(root.innerHTML, /本地存档读取失败：storage denied/);
  assert.equal((root.innerHTML.match(/data-connection-action=/g) || []).length, 2);
});

test("connection sequence cleanup cancels pending minimum waits", async () => {
  const jobs = [];
  const schedule = (callback, delay) => {
    const job = { callback, delay, cancelled: false };
    jobs.push(job);
    return job;
  };
  const cancel = (job) => {
    job.cancelled = true;
  };
  const root = createRoot();
  const presenter = renderEarthConnectionSequence(root, {
    schedule,
    cancel,
  });
  const waitResult = presenter.wait();

  presenter.cleanup();
  assert.equal(await waitResult, false);
  assert.ok(jobs.every((job) => job.cancelled));
  assert.equal(root.classList.has("is-connection"), false);
});

test("connection presenter exposes the approved projected lock anchor", async () => {
  const source = await readFile(
    new URL("../../src/ui/earth-connection-sequence.mjs", import.meta.url),
    "utf8",
  );

  assert.match(source, /connection-player-lock/);
  assert.match(source, /connection-lock-nw/);
  assert.match(source, /connection-lock-core/);
  assert.match(source, /projection\.visible/);
  assert.match(source, /unsubscribeAnchor\?\.\(\)/);
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
