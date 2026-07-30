import test from "node:test";
import assert from "node:assert/strict";
import { getHomeMarkup, renderHome } from "../../src/ui/home.mjs";

test("home first frame includes worldview, disclosure, radio command and lower-priority NPC note", () => {
  const markup = getHomeMarkup({
    population: 8_241_000_000,
    baseline: {
      timestampMs: Date.UTC(2024, 6, 1),
      source: "World Bank population baseline",
    },
  });

  assert.match(markup, /data-home-title/);
  assert.match(markup, /地球/);
  assert.match(markup, /约 82 亿名玩家正在共同运行这颗星球/);
  assert.match(markup, /data-population-estimate="8241000000"/);
  assert.match(markup, /data-population-as-of="2024-07-01"/);
  assert.match(markup, /World Bank population baseline/);
  assert.match(markup, /data-home-action="enter"/);
  assert.match(markup, /发送我的信号/);
  assert.match(markup, /data-lucide="radio"/);
  assert.ok(markup.indexOf("data-home-radio-command") < markup.indexOf("data-home-npc-note"));
  assert.doesNotMatch(markup, /card|panel|hud/i);
});

test("home icon rendering is requested immediately and no population timer is created", () => {
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
  } finally {
    globalThis.lucide = previousLucide;
  }
});
