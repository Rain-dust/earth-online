import {
  downloadSaveJson,
  importSave,
  loadLocalSave,
  readSaveFile,
  saveLocalSave,
} from "../core/storage.mjs";
import {
  completeOldSaveReview,
  confirmOldSaveAchievement,
  dismissOldSaveAchievement,
  getAchievementInstanceId,
  normalizeAchievementArchive,
  restoreDismissedOldSaveAchievement,
  revokeOldSaveAchievement,
  setAchievementPresentation,
} from "../core/achievements.mjs";
import { getNightTransitionDuration, recordNightSwitch } from "../core/night-transition.mjs";
import {
  deleteFreeRecord,
  ensureDailyRun,
  recordAdditionalMainProgress,
  refreshDailyMainAction,
  replaceDailyMaintenance,
  saveFreeRecord,
  setDailyStatus,
  syncMainAction,
  syncMaintenance,
} from "../core/daily-run.mjs";
import { getLocalDateKey } from "../core/local-date.mjs";
import {
  abandonMainQuest,
  completeMainQuest,
  createMainQuest,
  pauseMainQuest,
  setMainQuestAction,
  switchMainQuest,
} from "../core/main-quest.mjs";
import { createEarthScene } from "../scene/earth-scene.mjs";
import { renderHome } from "../ui/home.mjs";
import { renderInitTerminal } from "../ui/init-terminal.mjs";
import {
  createAchievementToastQueue,
  getNewAchievementIds,
  showAchievementToast,
} from "../ui/achievement-toast.mjs";
import { renderNightArchive } from "../ui/night-archive.mjs";
import { renderOldSaveReview, renderRecoveryCeremony } from "../ui/old-save-review.mjs";
import { renderSystemPanel } from "../ui/system-panel.mjs";
import { getDom, setSystemVisible } from "./dom.mjs";
import { applyPanelDayUpdate } from "./panel-day.mjs";

export function createApp() {
  const dom = getDom();
  const save = loadLocalSave();
  const scene = createEarthScene(dom.stage);
  const state = {
    mode: "home",
    save,
    scene,
    archiveFilter: "all",
    archiveSelectedId: null,
    transitionId: 0,
  };
  const achievementToastQueue = createAchievementToastQueue({
    show(id) {
      const instance = (Array.isArray(state.save?.achievements) ? state.save.achievements : [])
        .find((item) => getAchievementInstanceId(item) === id);
      return showAchievementToast(dom.body, { id, instance });
    },
  });
  let focusAttemptId = 0;

  function hideHomeOverlay() {
    dom.homeOverlay.classList.add("is-hidden");
    dom.homeOverlay.style.opacity = "0";
    dom.homeOverlay.style.filter = "blur(8px)";
    dom.homeOverlay.style.transform = "translateX(-24px)";
  }

  function showHomeOverlay() {
    dom.homeOverlay.classList.remove("is-hidden");
    dom.homeOverlay.style.opacity = "";
    dom.homeOverlay.style.filter = "";
    dom.homeOverlay.style.transform = "";
  }

  async function enter() {
    if (state.mode !== "home") {
      return;
    }

    const attemptId = ++focusAttemptId;
    state.mode = "focusing";
    hideHomeOverlay();
    dom.body.classList.add("is-zooming");

    try {
      await scene.focus();
      if (state.mode !== "focusing" || attemptId !== focusAttemptId) {
        return;
      }

      if (state.save.profile) {
        showPanel();
      } else {
        showInit();
      }
    } catch (error) {
      if (attemptId === focusAttemptId) {
        exitToHome();
      }
    }
  }

  function showInit() {
    state.mode = "init";
    clearNightClasses();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);
    renderInitTerminal(dom.systemRoot, {
      onComplete(nextSave) {
        state.save = saveLocalSave(nextSave);
        showPanel();
      },
      onExit: exitToHome,
    });
  }

  function showPanel() {
    state.mode = "panel";
    clearNightClasses();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);
    const today = getLocalDateKey();
    const preparedSave = ensureDailyRun(state.save, today);

    if (preparedSave !== state.save) {
      state.save = saveLocalSave(preparedSave);
    }

    const handleChange = (nextSave) => {
      if (nextSave === state.save) return;
      const previousAchievements = state.save?.achievements;
      state.save = saveLocalSave(nextSave);
      enqueueRuntimeAchievementNotices(previousAchievements, state.save?.achievements);
      showPanel();
    };

    renderPanel(handleChange, today);
  }

  function renderPanel(handleChange, today) {
    dom.systemRoot.replaceChildren();

    const updateDaily = (updater) => {
      const updated = applyPanelDayUpdate(state.save, today, updater);
      handleChange(updated.save);
    };

    const changeQuest = (updater) => {
      const currentDate = getLocalDateKey();
      const updated = updater(state.save);
      const prepared = ensureDailyRun(updated, currentDate);
      const nextSave = refreshDailyMainAction(prepared, currentDate);
      handleChange(nextSave);
    };

    renderSystemPanel(dom.systemRoot, {
      save: state.save,
      today,
      onStatusChange(status) {
        updateDaily((current, date) => setDailyStatus(current, date, status));
      },
      onMainSync() {
        updateDaily(syncMainAction);
      },
      onMainProgress(text) {
        updateDaily((current, date) => recordAdditionalMainProgress(current, date, text));
      },
      onMaintenanceSync() {
        updateDaily(syncMaintenance);
      },
      onMaintenanceReplace() {
        updateDaily(replaceDailyMaintenance);
      },
      onFreeRecordSave(input) {
        updateDaily((current, date) => saveFreeRecord(current, date, input));
      },
      onFreeRecordDelete() {
        updateDaily(deleteFreeRecord);
      },
      onMainQuestCreate(input) {
        changeQuest((current) => createMainQuest(current, input));
      },
      onMainQuestActionChange(text) {
        changeQuest((current) => setMainQuestAction(current, text));
      },
      onMainQuestPause() {
        changeQuest((current) => pauseMainQuest(current));
      },
      onMainQuestComplete() {
        changeQuest((current) => completeMainQuest(current));
      },
      onMainQuestSwitch(input) {
        changeQuest((current) => switchMainQuest(current, input));
      },
      onMainQuestAbandon() {
        changeQuest((current) => abandonMainQuest(current));
      },
      onOpenArchive: handleDayNightControl,
      onExit: exitToHome,
    });
  }

  async function openArchive() {
    if (state.mode !== "panel") return;

    const transitionId = ++state.transitionId;
    const now = new Date().toISOString();
    const dateKey = now.slice(0, 10);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const archive = normalizeAchievementArchive(state.save?.achievementArchive);
    const duration = getNightTransitionDuration(archive, dateKey, reducedMotion);

    state.mode = "transitioning-night";
    dom.systemRoot.classList.add("is-transitioning-night");

    try {
      await scene.toNight(duration);
      if (transitionId !== state.transitionId) return;

      state.save = saveLocalSave({
        ...state.save,
        achievementArchive: recordNightSwitch(archive, now),
      });
      dom.systemRoot.classList.remove("is-transitioning-night");
      dom.systemRoot.classList.add("is-night");
      showArchiveOrReview();
    } catch (error) {
      if (transitionId !== state.transitionId) return;
      dom.systemRoot.classList.remove("is-transitioning-night", "is-night");
      state.mode = "panel";
      scene.toDay(250).catch?.(() => {});
      showPanel({ persistGeneratedTasks: false });
    }
  }

  async function returnToDay() {
    if (!["archive", "archive-review", "archive-ceremony"].includes(state.mode)) return;

    const transitionId = ++state.transitionId;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    state.mode = "transitioning-day";
    dom.systemRoot.classList.add("is-transitioning-day");

    try {
      await scene.toDay(reducedMotion ? 250 : 700);
      if (transitionId !== state.transitionId) return;
      clearNightClasses();
      showPanel({ persistGeneratedTasks: false });
    } catch (error) {
      if (transitionId !== state.transitionId) return;
      clearNightClasses();
      showPanel({ persistGeneratedTasks: false });
    }
  }

  function showArchiveOrReview() {
    const archive = normalizeAchievementArchive(state.save?.achievementArchive);
    if (archive.scanStatus === "complete") {
      showArchive();
    } else {
      showOldSaveReview();
    }
  }

  function showArchive() {
    state.mode = "archive";
    dom.systemRoot.classList.remove("is-transitioning-night", "is-transitioning-day");
    dom.systemRoot.classList.add("is-night");
    setSystemVisible(dom.systemRoot, true);
    renderNightArchive(dom.systemRoot, {
      save: state.save,
      filter: state.archiveFilter,
      selectedId: state.archiveSelectedId,
      onFilterChange(nextFilter) {
        state.archiveFilter = nextFilter;
        showArchive();
      },
      onSelect(id) {
        state.archiveSelectedId = id;
        showArchive();
      },
      onPresentationChange(id, patch) {
        state.save = saveLocalSave(setAchievementPresentation(state.save, id, patch));
        showArchive();
      },
      onOpenReview: showOldSaveReview,
      onReturnDay: handleDayNightControl,
    });
  }

  function showOldSaveReview() {
    state.mode = "archive-review";
    dom.systemRoot.classList.remove("is-transitioning-night", "is-transitioning-day");
    dom.systemRoot.classList.add("is-night");
    setSystemVisible(dom.systemRoot, true);
    renderOldSaveReview(dom.systemRoot, {
      save: state.save,
      onConfirm(id) {
        updateReview((current) => confirmOldSaveAchievement(current, id));
      },
      onDismiss(id) {
        updateReview((current) => dismissOldSaveAchievement(current, id));
      },
      onRestoreDismissed(id) {
        updateReview((current) => restoreDismissedOldSaveAchievement(current, id));
      },
      onRevoke(id) {
        updateReview((current) => revokeOldSaveAchievement(current, id));
      },
      onComplete() {
        state.save = saveLocalSave(completeOldSaveReview(state.save));
        showRecoveryCeremony();
      },
      onReturnArchive: showArchive,
    });
  }

  function updateReview(updater) {
    state.save = saveLocalSave(updater(state.save));
    showOldSaveReview();
  }

  function showRecoveryCeremony() {
    state.mode = "archive-ceremony";
    renderRecoveryCeremony(dom.systemRoot, {
      save: state.save,
      onClose: showArchive,
      onSkip: showArchive,
    });
  }

  function skipActiveTransition() {
    if (state.mode === "transitioning-night" || state.mode === "transitioning-day") {
      scene.skipTransition();
    }
  }

  function handleDayNightControl() {
    if (state.mode === "transitioning-night" || state.mode === "transitioning-day") {
      skipActiveTransition();
      return;
    }
    if (state.mode === "panel") openArchive();
    if (state.mode === "archive" || state.mode === "archive-review") returnToDay();
  }

  function clearNightClasses() {
    dom.systemRoot.classList.remove("is-night", "is-transitioning-night", "is-transitioning-day");
  }

  function enqueueRuntimeAchievementNotices(previous, next) {
    const instances = Array.isArray(next) ? next : [];
    for (const id of getNewAchievementIds(previous, instances)) {
      const instance = instances.find((item) => getAchievementInstanceId(item) === id);
      if (instance?.source !== "old_save_confirmed") {
        achievementToastQueue.enqueue(id).catch(() => {});
      }
    }
  }

  function exitToHome() {
    focusAttemptId += 1;
    state.transitionId += 1;
    scene.skipTransition();
    state.mode = "home";
    clearNightClasses();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, false);
    showHomeOverlay();
    dom.body.classList.remove("is-zooming");
    scene.home();
  }

  dom.stage.addEventListener("dblclick", enter);
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.mode === "transitioning-night" || state.mode === "transitioning-day") {
      skipActiveTransition();
      return;
    }
    if (state.mode === "archive" || state.mode === "archive-review") {
      returnToDay();
      return;
    }
    if (state.mode === "archive-ceremony") {
      showArchive();
      return;
    }
    exitToHome();
  });
  dom.systemRoot.addEventListener("earth-online-export", () => {
    downloadSaveJson(state.save);
  });
  dom.systemRoot.addEventListener("earth-online-import", async (event) => {
    try {
      const text = await readSaveFile(event.detail);
      const nextSave = importSave(text, state.save);

      delete dom.systemRoot.dataset.systemMessage;
      state.save = saveLocalSave(nextSave);
      showPanel();
    } catch (error) {
      dom.systemRoot.dataset.systemMessage = error?.message || "Save import failed";
      showPanel({ persistGeneratedTasks: false });
    }
  });

  renderHome(dom.homeOverlay);
  setSystemVisible(dom.systemRoot, false);
  scene.start();

  return {
    enter,
    exitToHome,
    handleDayNightControl,
    openArchive,
    returnToDay,
    state,
  };
}
