import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { confirmFirstSignalRecord } from "../../src/core/first-signal-archive.mjs";
import {
  FIRST_SIGNAL_CONFIRMATION_DURATION,
  REDUCED_FIRST_SIGNAL_CONFIRMATION_DURATION,
  getFirstSignalArchiveMarkup,
  getFirstSignalConfirmationDuration,
  renderFirstSignalArchive,
} from "../../src/ui/first-signal-archive.mjs";

test("pending markup uses the exact P0 copy, stable hooks and runtime image", () => {
  const markup = getFirstSignalArchiveMarkup({});

  assert.match(markup, /待确认旧存档/);
  assert.match(markup, /你完成过一件曾以为做不到的事吗？/);
  assert.match(markup, /有，恢复这条/);
  assert.match(markup, /暂不恢复/);
  assert.match(markup, /data-first-signal-archive/);
  assert.match(markup, /data-record-id="first-signal-once-impossible"/);
  assert.match(markup, /data-first-signal-image-slot/);
  assert.match(markup, /src="\.\/assets\/achievements\/runtime\/first-signal-once-impossible\.png"/);
  assert.doesNotMatch(markup, /card|list|filter|tab|chat|bubble|rarity|percent|ranking/i);
});

test("recovered markup identifies the player and contains no fabricated rate", () => {
  const save = confirmFirstSignalRecord({}, "2026-07-24T12:30:00.000Z");
  const markup = getFirstSignalArchiveMarkup(save, { playerName: "<Rain>" });

  assert.match(markup, /旧存档已恢复/);
  assert.match(markup, /原来我做到了/);
  assert.match(markup, /&lt;Rain&gt;，你曾经做到过。/);
  assert.match(markup, /此记录由你确认/);
  assert.doesNotMatch(markup, /%|全球|排名|稀有/);
});

test("renderer routes pending actions through explicit callbacks", async () => {
  const fixture = createRendererFixture();
  const calls = [];
  const runtime = renderFirstSignalArchive(fixture.root, {
    save: {},
    playerName: "Rain",
    reducedMotion: true,
    onConfirm: (id) => calls.push(`confirm:${id}`),
    onContinue: () => calls.push("continue"),
    onReturn: () => calls.push("return"),
  });

  fixture.panel().action("confirm").click();
  assert.deepEqual(calls, ["confirm:first-signal-once-impossible"]);
  assert.equal(fixture.panel().dataset.recordState, "recovered");

  await new Promise((resolve) => setTimeout(
    resolve,
    REDUCED_FIRST_SIGNAL_CONFIRMATION_DURATION + 20,
  ));
  assert.deepEqual(calls, ["confirm:first-signal-once-impossible", "continue"]);
  runtime.destroy();
});

test("destroy cancels an active confirmation transition", async () => {
  const fixture = createRendererFixture();
  let returnCount = 0;
  const runtime = renderFirstSignalArchive(fixture.root, {
    save: {},
    reducedMotion: false,
    onConfirm() {},
    onContinue: () => {
      returnCount += 1;
    },
  });

  fixture.panel().action("confirm").click();
  runtime.destroy();
  await new Promise((resolve) => setTimeout(resolve, 5));

  assert.equal(returnCount, 0);
  assert.equal(fixture.panel().classList.contains("is-confirming"), false);
});

test("motion timing and responsive styles preserve the unframed Earth overlay", async () => {
  assert.equal(getFirstSignalConfirmationDuration(false), FIRST_SIGNAL_CONFIRMATION_DURATION);
  assert.equal(
    getFirstSignalConfirmationDuration(true),
    REDUCED_FIRST_SIGNAL_CONFIRMATION_DURATION,
  );

  const styles = await readFile(new URL("../../src/styles/achievements.css", import.meta.url), "utf8");
  assert.match(styles, /\.first-signal-archive\s*\{[^}]*position:\s*absolute;/s);
  assert.match(styles, /\.first-signal-archive\s*\{[^}]*env\(safe-area-inset-bottom\)/s);
  assert.match(styles, /\.first-signal-actions button\s*\{[^}]*min-height:\s*48px;/s);
  assert.match(styles, /@media \(max-width:\s*760px\), \(max-aspect-ratio:\s*10\s*\/\s*16\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*first-signal-archive\.is-confirming/);
  assert.doesNotMatch(styles, /\.first-signal-archive\s*\{[^}]*background:\s*#(?:000|000000|030507);/s);
});

function createRendererFixture() {
  let currentPanel = null;
  const root = {
    ownerDocument: {
      defaultView: {
        matchMedia: () => ({ matches: false }),
      },
      createElement: () => createPanel(),
    },
    replaceChildren(panel) {
      currentPanel = panel;
    },
  };

  return {
    root,
    panel: () => currentPanel,
  };
}

function createPanel() {
  const listeners = new Map();
  const actions = new Map();
  const classes = new Set();
  const panel = {
    dataset: {},
    setAttribute() {},
    querySelector(selector) {
      const match = selector.match(/data-first-signal-action='([^']+)'/);
      return match ? actions.get(match[1]) || null : null;
    },
    classList: {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      contains: (name) => classes.has(name),
    },
    action: (name) => actions.get(name),
  };

  Object.defineProperty(panel, "className", {
    set(value) {
      for (const name of value.split(/\s+/).filter(Boolean)) classes.add(name);
    },
  });
  Object.defineProperty(panel, "innerHTML", {
    set(value) {
      actions.clear();
      for (const name of ["confirm", "return"]) {
        if (!value.includes(`data-first-signal-action="${name}"`)) continue;
        actions.set(name, {
          addEventListener(type, callback) {
            listeners.set(`${name}:${type}`, callback);
          },
          click() {
            listeners.get(`${name}:click`)?.();
          },
        });
      }
    },
  });

  return panel;
}
