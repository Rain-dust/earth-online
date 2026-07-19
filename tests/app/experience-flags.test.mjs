import test from "node:test";
import assert from "node:assert/strict";
import {
  ENTRY_ROUTES,
  resolveEntryRoute,
  resolveExperienceMode,
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

test("legacy entry keeps the existing profile branch unchanged", () => {
  assert.equal(resolveEntryRoute("legacy", { profile: { nickname: "Rain" } }), ENTRY_ROUTES.PANEL);
  assert.equal(resolveEntryRoute("legacy", { profile: null }), ENTRY_ROUTES.INIT);
});

test("v0.4 entry always passes through the Earth connection sequence", () => {
  assert.equal(resolveEntryRoute("v04", { profile: { nickname: "Rain" } }), ENTRY_ROUTES.CONNECTION);
  assert.equal(resolveEntryRoute("v04", { profile: null }), ENTRY_ROUTES.CONNECTION);
});
