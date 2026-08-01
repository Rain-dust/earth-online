import test from "node:test";
import assert from "node:assert/strict";
import { getHomeMarkup, renderHome } from "../../src/ui/home.mjs";

test("home first frame includes worldview, radio command and lower-priority NPC note", () => {
  const markup = getHomeMarkup({
    population: 8_241_000_000,
    baseline: {
      timestampMs: Date.UTC(2024, 6, 1),
      source: "World Bank population baseline",
    },
  });

  assert.match(markup, /data-home-title/);
  assert.match(markup, /地球/);
  assert.match(markup, /GLOBAL PLAYERS ONLINE/);
  assert.match(markup, /8,241,000,000/);
  assert.match(markup, /全球在线玩家估算/);
  assert.match(markup, /data-population-estimate="8241000000"/);
  assert.doesNotMatch(markup, /世界人口动态估算|世界银行全球人口基准/);
  assert.match(markup, /data-home-action="enter"/);
  assert.match(markup, /发送我的信号/);
  assert.match(markup, /data-lucide="radio"/);
  assert.ok(markup.indexOf("data-home-radio-command") < markup.indexOf("data-home-npc-note"));
  assert.doesNotMatch(markup, /card|panel|hud/i);
});

test("home icon rendering and dynamic population cleanup are both exposed", () => {
  const previousLucide = globalThis.lucide;
  const calls = [];
  const root = { className: "", innerHTML: "" };
  globalThis.lucide = {
    createIcons(options) {
      calls.push(options);
    },
  };

  try {
    const cleanup = renderHome(root, { population: 8_241_000_000 });
    assert.equal(root.className, "home-overlay");
    assert.equal(calls.length, 1);
    assert.strictEqual(calls[0].root, root);
    assert.equal(typeof cleanup, "function");
    cleanup();
  } finally {
    globalThis.lucide = previousLucide;
  }
});
