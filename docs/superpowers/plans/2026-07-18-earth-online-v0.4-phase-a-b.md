# Earth Online v0.4 Phase A/B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a feature-flagged Earth connection sequence and resumable one-question-at-a-time onboarding without replacing the legacy runtime or rewriting existing business modules.

**Architecture:** Keep `controller.mjs` as the route coordinator and insert two focused UI sequences after the existing camera focus. Add an additive schema v3 onboarding record, preserve legacy profile fields, and keep the old initialization terminal and morning runtime available through a query-string rollback switch.

**Tech Stack:** Native ES modules, Three.js/three-globe, HTML/CSS, localStorage JSON saves, Node test runner.

---

### Task 1: Experience Feature Flag

**Files:**
- Create: `src/app/experience-flags.mjs`
- Create: `tests/app/experience-flags.test.mjs`

- [ ] **Step 1: Write failing flag-resolution tests**

Cover the default legacy mode, `?experience=v04`, `?experience=legacy`, and invalid values.

- [ ] **Step 2: Run the test and verify missing-module failure**

Run: `node --test tests/app/experience-flags.test.mjs`

- [ ] **Step 3: Implement the minimal resolver**

```js
export function resolveExperienceMode(search = "", fallback = "legacy") {
  const requested = new URLSearchParams(search).get("experience");
  return requested === "v04" || requested === "legacy" ? requested : fallback;
}
```

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/app/experience-flags.test.mjs`

### Task 2: Connection Sequence Model and Renderer

**Files:**
- Create: `src/ui/earth-connection-sequence.mjs`
- Create: `tests/ui/earth-connection-sequence.test.mjs`

- [ ] **Step 1: Write failing tests**

Test that a legacy profile routes to `returning_player`, an empty save and interrupted onboarding route to `new_player`, frames contain only one message, and cleanup prevents a stale completion callback.

- [ ] **Step 2: Verify the tests fail for the missing module**

Run: `node --test tests/ui/earth-connection-sequence.test.mjs`

- [ ] **Step 3: Implement pure route/frame helpers and the timer-driven renderer**

The renderer receives injected scheduler functions, writes unframed markup into the existing root, returns a cleanup function, and calls `onComplete(route)` once.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/ui/earth-connection-sequence.test.mjs`

### Task 3: Profile and Onboarding Domain

**Files:**
- Create: `src/core/player-profile.mjs`
- Create: `tests/core/player-profile.test.mjs`

- [ ] **Step 1: Write failing domain tests**

Cover required player name, all optional skips, birthday parsing with and without year, zodiac boundaries, MBTI normalization, persisted next-step state, malformed drafts, and finalization without overwriting existing save collections.

- [ ] **Step 2: Verify the tests fail**

Run: `node --test tests/core/player-profile.test.mjs`

- [ ] **Step 3: Implement additive onboarding state**

```js
{
  version: 1,
  status: "not_started",
  completedSteps: [],
  skippedSteps: [],
  lastStep: "player_name",
  draft: {}
}
```

Finalize to the existing `profile.nickname` field, attach sourced optional profile fields, and create an optional main quest through the existing main-quest API.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/core/player-profile.test.mjs`

### Task 4: Additive Save Migration

**Files:**
- Modify: `src/core/storage.mjs`
- Modify: `tests/core/storage.test.mjs`

- [ ] **Step 1: Add failing schema v3 migration tests**

Test empty v2 saves, v2 saves with profiles, interrupted v0.4 saves, malformed onboarding fields, unknown-field preservation, and export/import round trips.

- [ ] **Step 2: Verify expected failures**

Run: `node --test tests/core/storage.test.mjs`

- [ ] **Step 3: Add defaults and normalization**

Keep `SAVE_FORMAT` and `STORAGE_KEY` unchanged, bump only `SCHEMA_VERSION`, and add additive `onboarding` and `connection` records.

- [ ] **Step 4: Run storage and profile tests**

Run: `node --test tests/core/storage.test.mjs tests/core/player-profile.test.mjs`

### Task 5: One-Question Onboarding UI

**Files:**
- Create: `src/ui/player-onboarding-sequence.mjs`
- Create: `tests/ui/player-onboarding-sequence.test.mjs`

- [ ] **Step 1: Write failing markup and progression tests**

Assert that each step renders one question, no terminal shell/card/progress bar/chat bubble classes appear, skip controls are available only for optional fields, and summary counts derive from saved state.

- [ ] **Step 2: Verify missing-module failure**

Run: `node --test tests/ui/player-onboarding-sequence.test.mjs`

- [ ] **Step 3: Implement renderer and event wiring**

Use direct text, underline inputs and plain command options. Persist after every answer through `onSave`, rerender from the persisted onboarding record, and call `onComplete` only from the completed summary.

- [ ] **Step 4: Run focused UI/domain tests**

Run: `node --test tests/ui/player-onboarding-sequence.test.mjs tests/core/player-profile.test.mjs`

### Task 6: Controller and Earth Integration

**Files:**
- Modify: `src/app/controller.mjs`
- Modify: `src/scene/earth-scene.mjs`
- Modify: `src/styles.css`

- [ ] **Step 1: Add a failing connection-flow helper assertion if integration requires new route behavior**

The existing `state.mode !== "home"` guard remains authoritative for duplicate double-click protection.

- [ ] **Step 2: Insert the feature-flagged route**

Legacy mode keeps the exact current branch. v0.4 mode shows the connection sequence, then either the new onboarding sequence or the existing runtime compatibility path.

- [ ] **Step 3: Add lifecycle cleanup**

Cancel active timers before home, rerender, or route changes. Escape continues to return home. Any sequence error falls back to the matching legacy route.

- [ ] **Step 4: Add restrained presentation styles**

Text remains in globe negative space. Do not add centered surfaces, cards, progress bars, chat bubbles, HUD frames or new visual dependencies.

- [ ] **Step 5: Slow rather than stop Earth rotation during focus**

Replace the focus-time boolean stop with a small rotation speed and restore home speed on exit.

### Task 7: Full Verification

**Files:**
- No production changes

- [ ] **Step 1: Run syntax checks**

Run: `node --check src/app/controller.mjs; node --check src/ui/earth-connection-sequence.mjs; node --check src/ui/player-onboarding-sequence.mjs; node --check src/core/player-profile.mjs`

- [ ] **Step 2: Run the complete suite**

Run: `npm test`

- [ ] **Step 3: Manual browser verification**

Verify legacy default, `?experience=v04`, new save, returning save, refresh during every onboarding step, Escape, repeated double-click, reduced motion, desktop/mobile layout, and day/night entry after completion.

- [ ] **Step 4: Inspect the final diff**

Confirm no changes to daily-run, main-quest, activity-log, achievements, legacy initialization, or morning-panel modules.
