export const EXPERIENCE_MODES = Object.freeze({
  LEGACY: "legacy",
  V04: "v04",
});

export const FIRST_DAY_SEQUENCE_MODES = Object.freeze({
  SEQUENCE: "sequence",
  BROADCAST: "broadcast",
});

export const SIGNAL_RUNTIME_MODES = Object.freeze({
  CURRENT: "current",
  CLASSIC: "classic",
});

export const ENTRY_ROUTES = Object.freeze({
  CONNECTION: "connection",
  INIT: "init",
  PANEL: "panel",
});

export const RUNTIME_ROUTES = Object.freeze({
  ONBOARDING: "onboarding",
  BROADCAST: "broadcast",
  LEGACY_INIT: "legacy_init",
  LEGACY_PANEL: "legacy_panel",
});

export function resolveExperienceMode(search = "", fallback = EXPERIENCE_MODES.LEGACY) {
  const requested = new URLSearchParams(String(search || "")).get("experience");

  return Object.values(EXPERIENCE_MODES).includes(requested)
    ? requested
    : fallback;
}

export function resolveFirstDaySequenceMode(
  search = "",
  fallback = FIRST_DAY_SEQUENCE_MODES.SEQUENCE,
) {
  const requested = new URLSearchParams(String(search || "")).get("firstDay");

  return Object.values(FIRST_DAY_SEQUENCE_MODES).includes(requested)
    ? requested
    : fallback;
}

export function resolveSignalRuntimeMode(
  search = "",
  fallback = SIGNAL_RUNTIME_MODES.CURRENT,
) {
  const requested = new URLSearchParams(String(search || "")).get("signalRuntime");

  return Object.values(SIGNAL_RUNTIME_MODES).includes(requested)
    ? requested
    : fallback;
}

export function resolveEntryRoute(experienceMode, save = {}) {
  if (experienceMode === EXPERIENCE_MODES.V04) {
    return ENTRY_ROUTES.CONNECTION;
  }

  return save?.profile ? ENTRY_ROUTES.PANEL : ENTRY_ROUTES.INIT;
}

export function resolvePostConnectionRoute(experienceMode, save = {}) {
  if (experienceMode === EXPERIENCE_MODES.V04) {
    return save?.profile
      ? RUNTIME_ROUTES.BROADCAST
      : RUNTIME_ROUTES.ONBOARDING;
  }

  return save?.profile
    ? RUNTIME_ROUTES.LEGACY_PANEL
    : RUNTIME_ROUTES.LEGACY_INIT;
}
