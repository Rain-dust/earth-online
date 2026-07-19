import test from "node:test";
import assert from "node:assert/strict";
import {
  CONNECTION_ROUTES,
  getConnectionFrames,
  getConnectionFrameMarkup,
  getConnectionRoute,
  renderEarthConnectionSequence,
} from "../../src/ui/earth-connection-sequence.mjs";

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

test("connection frames show one unframed signal at a time", () => {
  for (const routeSave of [
    { profile: null },
    { profile: { nickname: "远行者" } },
  ]) {
    const frames = getConnectionFrames(routeSave);

    assert.ok(frames.length >= 2);
    for (const frame of frames) {
      const markup = getConnectionFrameMarkup(frame);
      assert.equal((markup.match(/<p\b/g) || []).length, 1);
      assert.doesNotMatch(markup, /panel|card|chat|bubble|progress/i);
      assert.doesNotMatch(markup, /<section\b|<article\b/);
    }
  }
});

test("connection sequence cleanup cancels stale completion callbacks", () => {
  const jobs = [];
  const schedule = (callback, delay) => {
    const job = { callback, delay, cancelled: false };
    jobs.push(job);
    return job;
  };
  const cancel = (job) => {
    job.cancelled = true;
  };
  const root = { innerHTML: "" };
  const completedRoutes = [];

  const cleanup = renderEarthConnectionSequence(root, {
    save: { profile: null },
    onComplete: (route) => completedRoutes.push(route),
    schedule,
    cancel,
  });

  assert.match(root.innerHTML, /earth-connection-signal/);
  assert.ok(jobs.length >= 2);

  cleanup();
  for (const job of jobs) {
    if (!job.cancelled) {
      job.callback();
    }
  }

  assert.deepEqual(completedRoutes, []);
  assert.ok(jobs.every((job) => job.cancelled));
});

test("connection sequence completes once with its resolved route", () => {
  const jobs = [];
  const schedule = (callback, delay) => {
    const job = { callback, delay, cancelled: false };
    jobs.push(job);
    return job;
  };
  const root = { innerHTML: "" };
  const completedRoutes = [];

  renderEarthConnectionSequence(root, {
    save: { profile: { nickname: "远行者" } },
    onComplete: (route) => completedRoutes.push(route),
    schedule,
    cancel: (job) => {
      job.cancelled = true;
    },
  });

  for (const job of jobs) {
    if (!job.cancelled) {
      job.callback();
    }
  }

  assert.deepEqual(completedRoutes, [CONNECTION_ROUTES.RETURNING_PLAYER]);
});
