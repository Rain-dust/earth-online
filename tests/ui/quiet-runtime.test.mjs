import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getQuietRuntimeMarkup,
  patchPlayerTerminalStatus,
  renderQuietRuntime,
} from "../../src/ui/quiet-runtime.mjs";

test("quiet runtime exposes three weak channels without becoming navigation or cards", () => {
  const markup = getQuietRuntimeMarkup({
    playerName: "远行者",
    quest: null,
  });

  assert.match(markup, /记录变化/);
  assert.match(markup, /当前主线/);
  assert.match(markup, /夜间档案/);
  assert.doesNotMatch(markup, /<nav\b|role="tab|tablist|card|pill|capsule/i);
  assert.doesNotMatch(markup, /<section\b|<article\b/);
});

test("opening one quiet channel marks the others for reduced presence", () => {
  const markup = getQuietRuntimeMarkup({
    playerName: "远行者",
    activeChannel: "record",
    record: { exists: false, text: "" },
    quest: {
      name: "完成 Earth Online",
      lastProgressDistance: { status: "known", text: "2 小时" },
    },
  });

  assert.match(markup, /data-active-channel="record"/);
  assert.match(markup, /最近发生了什么？/);
  assert.match(markup, /data-channel="quest" data-muted="true"/);
  assert.match(markup, /data-channel="archive" data-muted="true"/);
});

test("record feedback distinguishes a new daily record from an update", () => {
  const first = getQuietRuntimeMarkup({
    activeChannel: "record",
    recordFeedback: "收到一条新的玩家记录。",
  });
  const updated = getQuietRuntimeMarkup({
    activeChannel: "record",
    recordFeedback: "今日玩家记录已更新。",
  });

  assert.match(first, /收到一条新的玩家记录。/);
  assert.match(updated, /今日玩家记录已更新。/);
});

test("accepted daily mission expands from the player signal without becoming a fourth channel", () => {
  const markup = getQuietRuntimeMarkup({
    playerName: "远行者",
    activeChannel: "mission",
    dailyMission: {
      title: "喝一杯水",
      content: "即刻饮用一杯清水，建议容量 250ml。",
      acceptedAt: "2026-07-31T08:00:00.000Z",
      completedAt: null,
      skippedAt: null,
    },
  });

  assert.match(markup, /data-active-channel="mission"/);
  assert.match(markup, /即刻饮用一杯清水/);
  assert.match(markup, /data-daily-mission-action="complete"/);
  assert.equal((markup.match(/class="quiet-channel-trigger"/g) || []).length, 3);
});

test("quiet runtime cleanup removes delegated listeners", () => {
  const root = createRoot();
  const cleanup = renderQuietRuntime(root, {
    view: { playerName: "远行者", quest: null },
  });

  assert.equal(root.listeners.get("click").size, 1);
  assert.equal(root.listeners.get("submit").size, 1);

  cleanup();
  assert.equal(root.listeners.get("click").size, 0);
  assert.equal(root.listeners.get("submit").size, 0);
  assert.equal(root.classList.has("is-quiet"), false);
});

test("terminal status switches in place without rebuilding the terminal", () => {
  const buttons = ["stable_operation", "high_load", "low_energy"].map((status) => ({
    dataset: { playerStatus: status },
    attributes: { "aria-pressed": String(status === "stable_operation") },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  }));
  const terminal = {
    querySelectorAll(selector) {
      return selector === "[data-player-status]" ? buttons : [];
    },
  };
  const root = {
    querySelector(selector) {
      return selector === "[data-player-terminal]" ? terminal : null;
    },
  };

  assert.equal(patchPlayerTerminalStatus(root, "low_energy"), true);
  assert.deepEqual(
    buttons.map((button) => button.attributes["aria-pressed"]),
    ["false", "false", "true"],
  );
  assert.equal(patchPlayerTerminalStatus(root, "unknown"), false);
});

test("quiet presentation keeps a transparent world layer and visibly mutes inactive channels", async () => {
  const styles = await readFile(new URL("../../src/styles.css", import.meta.url), "utf8");

  assert.match(styles, /#system-root\.is-broadcast[\s\S]*#system-root\.is-quiet[\s\S]*background:\s*transparent;/);
  assert.match(styles, /quiet-channel-trigger\[data-muted="true"\][\s\S]*opacity:/);
  assert.match(styles, /quiet-channels[\s\S]*position:\s*absolute;/);
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
