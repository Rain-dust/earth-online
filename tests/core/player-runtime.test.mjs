import test from "node:test";
import assert from "node:assert/strict";
import {
  applyMissionReward,
  createInitialPlayerRuntime,
  getPlayerRuntimeView,
  normalizePlayerRuntime,
  pruneExpiredEffects,
} from "../../src/core/player-runtime.mjs";

const NOW = "2026-07-31T08:00:00.000Z";

test("initial player runtime exposes the seven approved values", () => {
  const view = getPlayerRuntimeView(createInitialPlayerRuntime(), NOW);

  assert.deepEqual(
    Object.fromEntries(view.attributes.map((item) => [item.id, item.value])),
    {
      vitality: 65,
      energy: 60,
      focus: 55,
      mood: 60,
      order: 50,
      connection: 50,
      exploration: 50,
    },
  );
});

test("normalization repairs malformed values without touching legacy save fields", () => {
  const runtime = normalizePlayerRuntime({
    attributes: {
      energy: { base: 999, growthCount: -2, lastGrowthWeek: 8 },
    },
    activeEffects: [{ id: "broken" }],
  });

  assert.equal(runtime.attributes.energy.base, 100);
  assert.equal(runtime.attributes.energy.growthCount, 0);
  assert.equal(runtime.attributes.energy.lastGrowthWeek, null);
  assert.deepEqual(runtime.activeEffects, []);
});

test("mission reward returns real values and a 45 minute effect", () => {
  const { runtime, result } = applyMissionReward(
    createInitialPlayerRuntime(),
    reward("hydrated", "滋润", "期间精力与专注小幅提升。", {
      energy: 1,
      focus: 1,
    }, "energy"),
    { now: NOW, weekKey: "2026-07-27" },
  );
  const view = getPlayerRuntimeView(runtime, NOW);

  assert.deepEqual(
    result.attributeChanges.map(({ id, before, after }) => ({ id, before, after })),
    [
      { id: "energy", before: 60, after: 61 },
      { id: "focus", before: 55, after: 56 },
    ],
  );
  assert.equal(result.effect.remainingMinutes, 45);
  assert.equal(view.activeEffects[0].name, "滋润");
});

test("same effect refreshes instead of stacking", () => {
  const first = applyMissionReward(
    createInitialPlayerRuntime(),
    reward("immersed", "沉浸", "期间专注小幅提升。", { focus: 2 }, "focus"),
    { now: NOW, weekKey: "2026-07-27" },
  ).runtime;
  const second = applyMissionReward(
    first,
    reward("immersed", "沉浸", "期间专注小幅提升。", { focus: 2 }, "focus"),
    { now: "2026-07-31T08:30:00.000Z", weekKey: "2026-07-27" },
  ).runtime;
  const view = getPlayerRuntimeView(second, "2026-07-31T08:30:00.000Z");

  assert.equal(view.activeEffects.length, 1);
  assert.equal(view.attributes.find((item) => item.id === "focus").value, 57);
  assert.equal(view.activeEffects[0].remainingMinutes, 45);
});

test("only the two newest distinct effects remain active", () => {
  let runtime = createInitialPlayerRuntime();

  for (const [index, id] of ["one", "two", "three"].entries()) {
    runtime = applyMissionReward(
      runtime,
      reward(id, id, `${id}状态。`, { energy: 1 }, "energy"),
      {
        now: `2026-07-31T08:0${index}:00.000Z`,
        weekKey: "2026-07-27",
      },
    ).runtime;
  }

  assert.deepEqual(runtime.activeEffects.map((effect) => effect.id), ["two", "three"]);
});

test("five qualifying tasks grow the base once per week", () => {
  let runtime = createInitialPlayerRuntime();
  let lastResult = null;

  for (let index = 0; index < 5; index += 1) {
    const applied = applyMissionReward(
      runtime,
      reward(`focus-${index}`, `专注${index}`, "期间专注小幅提升。", { focus: 1 }, "focus"),
      {
        now: `2026-07-3${index + 1}T08:00:00.000Z`,
        weekKey: "2026-07-27",
      },
    );
    runtime = applied.runtime;
    lastResult = applied.result;
  }

  assert.equal(runtime.attributes.focus.base, 56);
  assert.equal(runtime.attributes.focus.growthCount, 0);
  assert.deepEqual(lastResult.baseChanges, [{
    id: "focus",
    label: "专注",
    before: 55,
    after: 56,
  }]);

  for (let index = 0; index < 5; index += 1) {
    runtime = applyMissionReward(
      runtime,
      reward(`more-${index}`, `继续${index}`, "期间专注小幅提升。", { focus: 1 }, "focus"),
      {
        now: `2026-08-01T0${index}:00:00.000Z`,
        weekKey: "2026-07-27",
      },
    ).runtime;
  }

  assert.equal(runtime.attributes.focus.base, 56);
  assert.equal(runtime.attributes.focus.growthCount, 5);

  runtime = applyMissionReward(
    runtime,
    reward("next-week", "继续", "期间专注小幅提升。", { focus: 1 }, "focus"),
    {
      now: "2026-08-03T08:00:00.000Z",
      weekKey: "2026-08-03",
    },
  ).runtime;

  assert.equal(runtime.attributes.focus.base, 57);
  assert.equal(runtime.attributes.focus.growthCount, 1);
});

test("expired effects disappear without reducing base attributes", () => {
  const runtime = applyMissionReward(
    createInitialPlayerRuntime(),
    reward("hydrated", "滋润", "期间精力小幅提升。", { energy: 1 }, "energy"),
    { now: NOW, weekKey: "2026-07-27" },
  ).runtime;
  const pruned = pruneExpiredEffects(runtime, "2026-07-31T09:00:00.000Z");
  const view = getPlayerRuntimeView(pruned, "2026-07-31T09:00:00.000Z");

  assert.equal(view.activeEffects.length, 0);
  assert.equal(view.attributes.find((item) => item.id === "energy").value, 60);
});

function reward(id, name, description, changes, primaryAttribute) {
  return {
    sourceId: `task:${id}`,
    primaryAttribute,
    changes,
    effect: {
      id,
      name,
      description,
      durationMinutes: 45,
    },
  };
}
