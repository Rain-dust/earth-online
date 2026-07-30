import { searchLocations } from "../core/location-search.mjs";
import { formatLocationRecord } from "../core/player-location.mjs";

const RESULT_LIMIT = 3;

export function createLocationSelectorState() {
  return {
    status: "ready",
    phase: "search",
    query: "",
    candidateId: "",
    error: "",
  };
}

export function reduceLocationSelectorState(state, action, locations) {
  if (action?.type === "query") {
    return {
      ...state,
      phase: "search",
      query: String(action.value || ""),
      candidateId: "",
    };
  }

  if (action?.type === "reset") return createLocationSelectorState();

  if (action?.type === "select_city") {
    const candidate = locations.find((location) => location.id === action.value);
    return candidate
      ? { ...state, phase: "confirm", candidateId: candidate.id }
      : state;
  }

  return state;
}

export function getLocationSelectorMarkup(state, locations) {
  const source = Array.isArray(locations) ? locations : [];
  const current = { ...createLocationSelectorState(), ...state };

  return `
    <div class="player-onboarding-sequence location-selector" data-location-phase="${escapeHtml(current.phase)}" data-location-status="${escapeHtml(current.status)}">
      <button class="onboarding-exit" type="button" data-location-action="exit" aria-label="返回建档">×</button>
      <div class="onboarding-copy">
        <p class="onboarding-kicker">PLAYER SIGNAL / LOCATION</p>
        ${renderLocationContent(current, source)}
      </div>
    </div>
  `;
}

export function renderLocationSelector(root, {
  loadLocations,
  onConfirm = () => {},
  onExit = () => {},
} = {}) {
  const controller = new AbortController();
  let active = true;
  let locked = false;
  let locations = [];
  let state = { ...createLocationSelectorState(), status: "loading" };

  const render = ({ focusSearch = false } = {}) => {
    if (!active) return;
    root.innerHTML = getLocationSelectorMarkup(state, locations);
    if (focusSearch) {
      const input = root.querySelector?.("[name='locationQuery']");
      input?.focus?.();
      input?.setSelectionRange?.(input.value.length, input.value.length);
    }
  };

  const handleClick = async (event) => {
    if (!active || locked) return;
    const button = event.target?.closest?.("[data-location-action]");
    if (!button) return;
    const action = button.dataset.locationAction;

    if (action === "exit") {
      cleanup();
      onExit();
      return;
    }
    if (action === "retry") {
      void load();
      return;
    }
    if (action === "confirm") {
      const candidate = locations.find((location) => location.id === state.candidateId);
      if (!candidate) return;
      locked = true;
      try {
        await onConfirm(candidate);
      } catch (error) {
        if (!active) return;
        locked = false;
        state = {
          ...state,
          status: "error",
          error: error?.message || "城市锚点暂时无法建立",
        };
        render();
      }
      return;
    }

    state = reduceLocationSelectorState(state, {
      type: action,
      value: button.dataset.value,
    }, locations);
    render();
  };

  const handleInput = (event) => {
    if (event.target?.name !== "locationQuery" || locked) return;
    state = reduceLocationSelectorState(state, {
      type: "query",
      value: event.target.value,
    }, locations);
    render({ focusSearch: true });
  };

  const handleKeydown = (event) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cleanup();
    onExit();
  };

  async function load() {
    state = { ...state, status: "loading", error: "" };
    render();
    try {
      const loaded = await loadLocations?.({ signal: controller.signal });
      if (!active) return;
      locations = Array.isArray(loaded) ? loaded : [];
      if (locations.length === 0) throw new Error("本地点位索引为空");
      state = createLocationSelectorState();
    } catch (error) {
      if (!active || error?.name === "AbortError") return;
      state = {
        ...createLocationSelectorState(),
        status: "error",
        error: error?.message || "地点索引加载失败",
      };
    }
    render();
  }

  function cleanup() {
    if (!active) return;
    active = false;
    controller.abort();
    root.removeEventListener?.("click", handleClick);
    root.removeEventListener?.("input", handleInput);
    root.removeEventListener?.("keydown", handleKeydown);
  }

  root.addEventListener?.("click", handleClick);
  root.addEventListener?.("input", handleInput);
  root.addEventListener?.("keydown", handleKeydown);
  void load();
  return cleanup;
}

function renderLocationContent(state, locations) {
  if (state.status === "loading") {
    return `
      <h2 data-onboarding-question>正在读取本地点位索引……</h2>
      <button class="onboarding-skip" type="button" data-location-action="exit">返回建档</button>
    `;
  }

  if (state.status === "error") {
    return `
      <h2 data-onboarding-question>地点索引暂时无法读取。</h2>
      <p class="onboarding-error" role="alert">${escapeHtml(state.error)}</p>
      <div class="onboarding-options">
        <button type="button" data-location-action="retry">重新读取</button>
      </div>
      <button class="onboarding-skip" type="button" data-location-action="exit">返回建档</button>
    `;
  }

  if (state.phase === "confirm") {
    const candidate = locations.find((location) => location.id === state.candidateId);
    return `
      <h2 data-onboarding-question>你选择：${escapeHtml(formatLocationRecord(candidate))}</h2>
      <div class="onboarding-options">
        <button type="button" data-location-action="confirm">在这里建立城市锚点</button>
        <button type="button" data-location-action="reset">重新选择</button>
      </div>
    `;
  }

  const matches = searchLocations(locations, state.query, { limit: RESULT_LIMIT });
  return `
    <h2 data-onboarding-question>搜索你选择的城市</h2>
    <label class="location-search-label" for="location-search">全球城市搜索</label>
    <input class="location-search-input" id="location-search" name="locationQuery" value="${escapeHtml(state.query)}" autocomplete="off" />
    <div class="location-results" aria-live="polite" data-location-results>
      ${matches.length > 0
        ? matches.map((location) => `
          <button type="button" data-location-result data-location-action="select_city" data-value="${escapeHtml(location.id)}">
            ${escapeHtml(formatLocationRecord(location))}
          </button>
        `).join("")
        : `<p class="location-empty">${state.query ? "没有找到匹配城市。" : "输入城市名称开始搜索。"}</p>`}
    </div>
  `;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
