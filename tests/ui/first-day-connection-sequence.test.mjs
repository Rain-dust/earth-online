import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getFirstDayConnectionMarkup } from "../../src/ui/first-day-connection-sequence.mjs";

const MODULE_URL = new URL("../../src/ui/first-day-connection-sequence.mjs", import.meta.url);
const STYLE_URL = new URL("../../src/styles/first-day-sequence.css", import.meta.url);

test("first-day markup keeps the achievement as one complete notification object", () => {
  const markup = getFirstDayConnectionMarkup({
    location: {
      cityDisplayName: "Shenzhen",
      latitude: 22.54,
      longitude: 114.06,
    },
    achievement: {
      title: "LINK START!",
      description: "Connected",
      rarityPercent: 100,
      imageAsset: "./assets/achievements/link-start.png",
    },
    task: {
      title: "Complete the first signal",
      source: "Earth Online",
    },
  });

  assert.match(markup, /class="first-day-achievement"/);
  assert.match(markup, /LINK START!/);
  assert.match(markup, /link-start\.png/);
  assert.match(markup, /100%/);
  assert.match(markup, /Complete the first signal/);
  assert.equal((markup.match(/data-first-day-action=/g) || []).length, 1);
  assert.doesNotMatch(markup, /<section\b|<article\b|<nav\b/);
  assert.doesNotMatch(markup, /card|panel|chat|bubble|tablist|role="tab"/i);
});

test("first-day renderer waits for a visible anchor and cleans every runtime handle", async () => {
  const source = await readFile(MODULE_URL, "utf8");

  assert.match(source, /projection\?\.visible\s*&&\s*!started/);
  assert.match(source, /const unsubscribe = subscribe/);
  assert.match(source, /timers\.forEach\(\(timer\) => globalThis\.clearTimeout/);
  assert.match(source, /unsubscribe\?\.\(\)/);
  assert.match(source, /removeEventListener\("click", onClick\)/);
  assert.match(source, /classList\.remove\("is-first-day"\)/);
});

test("connection timestamps are delegated to onPresented, not written by the UI", async () => {
  const source = await readFile(MODULE_URL, "utf8");

  assert.match(source, /nextPhase === "revealed"/);
  assert.match(source, /onPresented\(\)/);
  assert.doesNotMatch(source, /lastActiveAt|lastBroadcastAt|firstConnectedAt|localStorage/);
});

test("styles preserve Earth dominance and provide desktop and mobile motion", async () => {
  const styles = await readFile(STYLE_URL, "utf8");

  assert.match(styles, /#system-root\.is-first-day\s*\{[^}]*background:\s*transparent;/s);
  assert.match(styles, /\.first-day-achievement\s*\{[^}]*position:\s*absolute;/s);
  assert.match(styles, /first-day-achievement-arrive/);
  assert.match(styles, /first-day-link-arrive/);
  assert.match(styles, /@media \(max-width:\s*700px\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /@media \(prefers-reduced-motion:\s*reduce\)/);
  assert.doesNotMatch(styles, /\.first-day-sequence\s*\{[^}]*background:/s);
});
