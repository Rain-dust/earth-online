import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY_ROUTES,
  FIRST_DAY_SEQUENCE_MODES,
  RUNTIME_ROUTES,
  resolveEntryRoute,
  resolveExperienceMode,
  resolveFirstDaySequenceMode,
  resolvePostConnectionRoute,
} from "../../src/app/experience-flags.mjs";

test("experience mode defaults to the legacy path", () => {
  assert.equal(resolveExperienceMode(""), "legacy");
  assert.equal(resolveExperienceMode("?other=value"), "legacy");
});

test("experience mode accepts the explicit v0.4 preview", () => {
  assert.equal(resolveExperienceMode("?experience=v04"), "v04");
});

test("experience mode accepts an explicit legacy rollback", () => {
  assert.equal(resolveExperienceMode("?experience=legacy", "v04"), "legacy");
});

test("experience mode ignores unsupported values", () => {
  assert.equal(resolveExperienceMode("?experience=future", "legacy"), "legacy");
  assert.equal(resolveExperienceMode("?experience=future", "v04"), "v04");
});

test("first-day sequence defaults to the approved motion flow", () => {
  assert.equal(
    resolveFirstDaySequenceMode("?experience=v04"),
    FIRST_DAY_SEQUENCE_MODES.SEQUENCE,
  );
});

test("first-day sequence has an explicit broadcast rollback", () => {
  assert.equal(
    resolveFirstDaySequenceMode("?experience=v04&firstDay=broadcast"),
    FIRST_DAY_SEQUENCE_MODES.BROADCAST,
  );
});

test("unsupported first-day values preserve the requested fallback", () => {
  assert.equal(
    resolveFirstDaySequenceMode("?firstDay=future"),
    FIRST_DAY_SEQUENCE_MODES.SEQUENCE,
  );
  assert.equal(
    resolveFirstDaySequenceMode("?firstDay=future", FIRST_DAY_SEQUENCE_MODES.BROADCAST),
    FIRST_DAY_SEQUENCE_MODES.BROADCAST,
  );
});

test("legacy entry keeps the existing profile branch unchanged", () => {
  assert.equal(resolveEntryRoute("legacy", { profile: { nickname: "Rain" } }), ENTRY_ROUTES.PANEL);
  assert.equal(resolveEntryRoute("legacy", { profile: null }), ENTRY_ROUTES.INIT);
});

test("v0.4 entry always passes through the Earth connection sequence", () => {
  assert.equal(resolveEntryRoute("v04", { profile: { nickname: "Rain" } }), ENTRY_ROUTES.CONNECTION);
  assert.equal(resolveEntryRoute("v04", { profile: null }), ENTRY_ROUTES.CONNECTION);
});

test("v0.4 post-connection routing never enters the legacy panel", () => {
  assert.equal(
    resolvePostConnectionRoute("v04", { profile: { nickname: "Rain" } }),
    RUNTIME_ROUTES.BROADCAST,
  );
  assert.equal(
    resolvePostConnectionRoute("v04", { profile: null }),
    RUNTIME_ROUTES.ONBOARDING,
  );
});

test("legacy post-connection routing preserves the old experience", () => {
  assert.equal(
    resolvePostConnectionRoute("legacy", { profile: { nickname: "Rain" } }),
    RUNTIME_ROUTES.LEGACY_PANEL,
  );
  assert.equal(
    resolvePostConnectionRoute("legacy", { profile: null }),
    RUNTIME_ROUTES.LEGACY_INIT,
  );
});
