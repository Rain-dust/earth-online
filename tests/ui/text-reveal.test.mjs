import test from "node:test";
import assert from "node:assert/strict";
import { revealText } from "../../src/ui/text-reveal.mjs";

test("text reveal exposes the full accessible label while revealing Chinese characters", async () => {
  const element = fakeElement();
  const jobs = [];
  const reveal = revealText(element, "玩家已确认。", {
    schedule(callback, delay) { jobs.push({ callback, delay }); return jobs.length; },
    cancel() {},
  });

  assert.equal(element.attributes.get("aria-label"), "玩家已确认。");
  assert.equal(element.textContent, "");
  jobs.shift().callback();
  assert.equal(element.textContent, "玩");
  reveal.complete();
  assert.equal(element.textContent, "玩家已确认。");
  assert.equal(await reveal.promise, "complete");
});

test("text reveal gives punctuation extra delay and reduced motion completes immediately", () => {
  const element = fakeElement();
  const delays = [];
  revealText(element, "你，好。", {
    schedule(callback, delay) { delays.push(delay); return delays.length; },
    cancel() {},
  });
  assert.equal(delays[0], 40);

  const reduced = fakeElement();
  const reveal = revealText(reduced, "立即显示。", { reducedMotion: true });
  assert.equal(reduced.textContent, "立即显示。");
  assert.equal(reveal.finished, true);
});

test("text reveal aborts without writing into destroyed DOM", async () => {
  const element = fakeElement();
  const jobs = [];
  const controller = new AbortController();
  const reveal = revealText(element, "不会继续", {
    signal: controller.signal,
    schedule(callback) { jobs.push(callback); return jobs.length; },
    cancel() {},
  });

  controller.abort();
  jobs.shift()?.();
  assert.equal(element.textContent, "");
  assert.equal(await reveal.promise, "cancelled");
});

test("Enter, Space and click complete the current reveal", () => {
  for (const trigger of ["Enter", " ", "click"]) {
    const element = fakeElement();
    revealText(element, "完整句子", {
      schedule() { return 1; },
      cancel() {},
    });
    element.dispatch(trigger === "click" ? "click" : "keydown", { key: trigger });
    assert.equal(element.textContent, "完整句子");
  }
});

function fakeElement() {
  const listeners = new Map();
  return {
    textContent: "",
    attributes: new Map(),
    setAttribute(name, value) { this.attributes.set(name, value); },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name) { listeners.delete(name); },
    dispatch(name, event = {}) { listeners.get(name)?.({ preventDefault() {}, ...event }); },
  };
}
