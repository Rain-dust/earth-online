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

test("v0.4 home signal and first archive remain outside the legacy panel", async () => {
  const source = await readFile(controllerUrl, "utf8");

  assert.match(source, /\[data-home-action='enter'\]/);
  assert.match(source, /scene\.establishPlayerSignal\(location/);
  assert.match(source, /function showFirstSignalArchive\(\)/);
  assert.match(source, /renderFirstSignalArchive/);
  assert.match(source, /state\.mode = "first-signal-archive"/);
});

function getFunctionBlock(source, startName, endName) {
  const start = source.indexOf(`function ${startName}`);
  const end = source.indexOf(`function ${endName}`, start + 1);
  return source.slice(start, end);
}
