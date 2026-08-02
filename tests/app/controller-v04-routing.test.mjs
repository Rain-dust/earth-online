import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const controllerUrl = new URL("../../src/app/controller.mjs", import.meta.url);

test("v0.4 connection and onboarding completion do not call the legacy panel", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const connection = getFunctionBlock(source, "showConnection", "showOnboarding");
  const onboarding = getFunctionBlock(source, "showOnboarding", "showInit");

  assert.match(connection, /showBroadcast\(|showOnboarding\(/);
  assert.doesNotMatch(connection, /showPanel\(/);
  assert.match(onboarding, /showBroadcast\(/);
  assert.doesNotMatch(onboarding, /showPanel\(/);
});

test("broadcast timestamps are committed after the UI mount succeeds", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const broadcast = getFunctionBlock(source, "showBroadcast", "showFirstDaySequence");

  const mountIndex = broadcast.indexOf("renderSystemBroadcast(");
  const commitIndex = broadcast.indexOf("markBroadcastShown(");
  assert.ok(mountIndex >= 0);
  assert.ok(commitIndex > mountIndex);
});

test("approved first-day sequence is isolated behind a rollback flag", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const broadcast = getFunctionBlock(source, "showBroadcast", "showFirstDaySequence");

  assert.match(broadcast, /broadcast\.type === "first_connection"/);
  assert.match(broadcast, /FIRST_DAY_SEQUENCE_MODES\.SEQUENCE/);
  assert.match(broadcast, /showFirstDaySequence\(/);
});

test("first-day connection commits timestamps only after the achievement is presented", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const firstDay = getFunctionBlock(source, "showFirstDaySequence", "showQuiet");

  const mountIndex = firstDay.indexOf("renderFirstDayConnectionSequence(");
  const presentedIndex = firstDay.indexOf("onPresented()");
  const commitIndex = firstDay.indexOf("markBroadcastShown(");
  assert.ok(mountIndex >= 0);
  assert.ok(presentedIndex > mountIndex);
  assert.ok(commitIndex > presentedIndex);
  assert.match(firstDay, /const preparedSave = ensureDailyRun/);
  assert.match(firstDay, /if \(state\.mode !== "first_day"\) return/);
  assert.doesNotMatch(firstDay, /showPanel\(/);
});

test("first-day continue enters Quiet and never auto-opens the legacy panel", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const firstDay = getFunctionBlock(source, "showFirstDaySequence", "showQuiet");

  assert.match(firstDay, /onContinue\(\)/);
  assert.match(firstDay, /showQuiet\(\)/);
  assert.doesNotMatch(firstDay, /showPanel\(/);
});

test("night archive carries an explicit day return mode", async () => {
  const source = await readFile(controllerUrl, "utf8");

  assert.match(source, /archiveReturnMode/);
  assert.match(source, /openArchive\(\{\s*returnMode:/);
});

test("v0.4 night archive continues from the first signal into the unframed signal review", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const router = getFunctionBlock(source, "showArchiveOrReview", "showFirstSignalArchive");
  const firstSignal = getFunctionBlock(source, "showFirstSignalArchive", "showArchive");

  assert.match(router, /getFirstSignalArchiveView\(state\.save\)/);
  assert.match(router, /if \(!firstSignal\.recovered\)/);
  assert.match(router, /archive\.scanStatus !== "complete"/);
  assert.match(router, /showOldSaveSignalReview\(\)/);
  assert.match(
    router,
    /EXPERIENCE_MODES\.V04[\s\S]*archive\.scanStatus !== "complete"[\s\S]*showOldSaveSignalReview\(\)[\s\S]*return;/,
  );
  assert.match(firstSignal, /onContinue: showArchiveOrReview/);
  assert.match(firstSignal, /onReturn: returnToDay/);
});

test("v0.4 home signal and first archive remain outside the legacy panel", async () => {
  const source = await readFile(controllerUrl, "utf8");

  assert.match(source, /\[data-home-action='enter'\]/);
  assert.match(source, /scene\.establishPlayerSignal\(location/);
  assert.match(source, /function showFirstSignalArchive\(\)/);
  assert.match(source, /renderFirstSignalArchive/);
  assert.match(source, /state\.mode = "first-signal-archive"/);
});

test("Escape from the unframed archive signal review returns through the day transition", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const keydown = source.slice(source.indexOf('window.addEventListener("keydown"'));

  assert.match(keydown, /state\.mode === "archive-signal-review"/);
  assert.match(keydown, /returnToDay\(\)/);
  assert.match(source, /scene\.resetToDay\(\);\s*scene\.home\(\);/);
});

test("reduced-motion entry keeps a visual settle before mounting connection signals", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const enter = getFunctionBlock(source, "enter", "showConnection");

  assert.match(source, /REDUCED_MOTION_ENTRY_SETTLE_MS = 700/);
  assert.match(enter, /Promise\.all\(/);
  assert.match(enter, /delayWithSignal\(reducedMotion \? REDUCED_MOTION_ENTRY_SETTLE_MS : 0\)/);
});

test("returning players can restore an anchor from a compatible onboarding draft", async () => {
  const source = await readFile(controllerUrl, "utf8");
  const connection = getFunctionBlock(source, "showConnection", "showOnboarding");

  assert.match(
    connection,
    /state\.save\.profile\?\.location\s*\|\|\s*state\.save\.onboarding\?\.draft\?\.location/,
  );
  assert.match(connection, /presenter\.showAnchor/);
  assert.match(connection, /scene\.subscribeLocationProjection/);
});

function getFunctionBlock(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  return source.slice(start, end);
}
