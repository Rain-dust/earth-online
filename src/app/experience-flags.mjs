export const EXPERIENCE_MODES = Object.freeze({
  LEGACY: "legacy",
  V04: "v04",
});

export const ENTRY_ROUTES = Object.freeze({
  CONNECTION: "connection",
  INIT: "init",
  PANEL: "panel",
});

export function resolveExperienceMode(search = "", fallback = EXPERIENCE_MODES.LEGACY) {
  const requested = new URLSearchParams(String(search || "")).get("experience");

  return Object.values(EXPERIENCE_MODES).includes(requested)
    ? requested
    : fallback;
}

export function resolveEntryRoute(experienceMode, save = {}) {
  if (experienceMode === EXPERIENCE_MODES.V04) {
    return ENTRY_ROUTES.CONNECTION;
  }

  return save?.profile ? ENTRY_ROUTES.PANEL : ENTRY_ROUTES.INIT;
}
