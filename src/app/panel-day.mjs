import { ensureDailyRun } from "../core/daily-run.mjs";
import { getLocalDateKey } from "../core/local-date.mjs";

export function preparePanelDay(save, renderedDate, currentDate = getLocalDateKey()) {
  return {
    date: currentDate,
    dateChanged: renderedDate !== currentDate,
    save: ensureDailyRun(save, currentDate),
  };
}

export function applyPanelDayUpdate(
  save,
  renderedDate,
  updater,
  currentDate = getLocalDateKey(),
) {
  const prepared = preparePanelDay(save, renderedDate, currentDate);

  return {
    ...prepared,
    save: updater(prepared.save, prepared.date),
  };
}
