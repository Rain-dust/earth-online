import {
  createEmptySave,
  downloadSaveJson,
  importSave,
  loadLocalSave,
  readLocalSaveSnapshot,
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
import { confirmFirstSignalRecord } from "../core/first-signal-archive.mjs";
import { getFirstSignalArchiveView } from "../core/first-signal-archive.mjs";
import { buildFirstDaySequenceView } from "../core/first-day-sequence.mjs";
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
  formatTimeDistance,
  resolveCurrentMainQuestLastActivityAt,
  resolveSystemBroadcast,
} from "../core/system-broadcast-resolver.mjs";
import {
  abandonMainQuest,
  completeMainQuest,
  createMainQuest,
  pauseMainQuest,
  setMainQuestAction,
  switchMainQuest,
} from "../core/main-quest.mjs";
import { createEarthScene } from "../scene/earth-scene.mjs";
import {
  CONNECTION_ROUTES,
  getConnectionRoute,
  renderEarthConnectionSequence,
} from "../ui/earth-connection-sequence.mjs";
import { renderHome } from "../ui/home.mjs";
import { renderFirstSignalArchive } from "../ui/first-signal-archive.mjs";
import { renderFirstDayConnectionSequence } from "../ui/first-day-connection-sequence.mjs";
import { renderInitTerminal } from "../ui/init-terminal.mjs";
import { renderPlayerOnboardingSequence } from "../ui/player-onboarding-sequence.mjs";
import { renderSignalLinkOverlay } from "../ui/signal-link-overlay.mjs";
import { renderQuietRuntime } from "../ui/quiet-runtime.mjs";
import { renderSystemBroadcast } from "../ui/system-broadcast.mjs";
import { createRuntimeAudio } from "../ui/runtime-audio.mjs";
import {
  createAchievementToastQueue,
  getNewAchievementIds,
  showAchievementToast,
} from "../ui/achievement-toast.mjs";
import { renderNightArchive } from "../ui/night-archive.mjs";
import { renderOldSaveReview, renderRecoveryCeremony } from "../ui/old-save-review.mjs";
import { renderSystemPanel } from "../ui/system-panel.mjs";
import { getDom, setSystemVisible } from "./dom.mjs";
import {
  ENTRY_ROUTES,
  EXPERIENCE_MODES,
  FIRST_DAY_SEQUENCE_MODES,
  RUNTIME_ROUTES,
  resolveEntryRoute,
  resolveExperienceMode,
  resolveFirstDaySequenceMode,
  resolvePostConnectionRoute,
} from "./experience-flags.mjs";
import { applyPanelDayUpdate } from "./panel-day.mjs";
import { captureConnectionSnapshot, markBroadcastShown } from "./runtime-session.mjs";

export function createApp() {
  const dom = getDom();
  const locationSearch = globalThis.location?.search || "";
  const experienceMode = resolveExperienceMode(locationSearch);
  const firstDaySequenceMode = resolveFirstDaySequenceMode(locationSearch);
  const save = experienceMode === EXPERIENCE_MODES.V04
    ? createEmptySave()
    : loadLocalSave();
  const scene = createEarthScene(dom.stage);
  const runtimeAudio = createRuntimeAudio(globalThis.window);
  const state = {
    mode: "home",
    save,
    scene,
    experienceMode,
    firstDaySequenceMode,
    archiveFilter: "all",
    archiveSelectedId: null,
    archiveReturnMode: null,
    connectionSnapshot: { previousLastActiveAt: null },
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
  let activeSequenceCleanup = null;

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
    runtimeAudio.play("signal");
    state.mode = "focusing";
    hideHomeOverlay();
    dom.body.classList.add("is-zooming");

    try {
      await scene.focus();
      if (state.mode !== "focusing" || attemptId !== focusAttemptId) {
        return;
      }

      const route = resolveEntryRoute(state.experienceMode, state.save);
      if (route === ENTRY_ROUTES.CONNECTION) {
        showConnection();
      } else if (route === ENTRY_ROUTES.PANEL) {
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

  async function showConnection() {
    cleanupActiveSequence();
    state.mode = "connecting";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);

    let presenter = null;

    try {
      presenter = renderEarthConnectionSequence(dom.systemRoot, {
        reducedMotion: prefersReducedMotion(),
        onAction(action) {
          if (action === "retry") showConnection();
          if (action === "return_home") exitToHome();
        },
      });
      activeSequenceCleanup = presenter.cleanup;

      if (!await presenter.wait() || state.mode !== "connecting") return;
      const readResult = readLocalSaveSnapshot();

      if (readResult.status === "error") {
        showConnectionFailure(presenter, readResult.error, "本地存档读取失败");
        return;
      }

      state.save = readResult.save;
      scene.setPlayerLocation(state.save.profile?.location || state.save.onboarding?.draft?.location);
      state.connectionSnapshot = captureConnectionSnapshot(state.save);
      presenter.show(readResult.status === "found"
        ? { id: "save_found", text: "本地存档已找到。" }
        : { id: "save_empty", text: "未发现本地存档。" });

      if (!await presenter.wait() || state.mode !== "connecting") return;
      const route = resolvePostConnectionRoute(state.experienceMode, state.save);

      if (route === RUNTIME_ROUTES.ONBOARDING) {
        presenter.show({
          id: "onboarding_required",
          text: readResult.status === "found"
            ? "玩家档案尚未完成。"
            : "准备建立新的玩家档案。",
        });
        if (!await presenter.wait() || state.mode !== "connecting") return;
        presenter.finish();
        activeSequenceCleanup = null;
        showOnboarding();
        return;
      }

      const connectionRoute = getConnectionRoute(state.save);
      if (connectionRoute !== CONNECTION_ROUTES.RETURNING_PLAYER) {
        throw new Error("玩家档案状态无法确认");
      }

      presenter.show({
        id: "player_identified",
        text: `玩家 ${state.save.profile?.nickname || "未命名玩家"} 已确认。`,
      });
      if (!await presenter.wait() || state.mode !== "connecting") return;

      const savedLocation = state.save.profile?.location;
      if (savedLocation) {
        presenter.show({
          id: "restoring_signal",
          text: `正在重新连接 ${savedLocation.city || "已存档城市"} 的玩家信号……`,
        });
        const handshake = await scene.establishPlayerSignal(savedLocation, {
          reducedMotion: prefersReducedMotion(),
          mode: "restore",
        });
        if (handshake.status !== "completed" || state.mode !== "connecting") return;
        runtimeAudio.play("confirmed");
      }

      presenter.show({ id: "resolving_broadcast", text: "正在检查新的系统事件……" });
      if (!await presenter.wait() || state.mode !== "connecting") return;

      const preview = resolveSystemBroadcast(state.save, {
        now: new Date().toISOString(),
        previousLastActiveAt: state.connectionSnapshot.previousLastActiveAt,
      });
      presenter.show(preview.type === "active_main_quest"
        ? { id: "event_found", text: "发现 1 条未处理事件。" }
        : { id: "no_event", text: "当前没有新的系统事件。" });
      if (!await presenter.wait() || state.mode !== "connecting") return;

      presenter.finish();
      activeSequenceCleanup = null;
      showBroadcast({
        previousLastActiveAt: state.connectionSnapshot.previousLastActiveAt,
      });
    } catch (error) {
      if (state.mode === "connecting") {
        if (presenter) {
          showConnectionFailure(presenter, error, "连接流程中断");
        } else {
          showRuntimeError(error, {
            prefix: "连接流程中断",
            onRetry: showConnection,
          });
        }
      }
    }
  }

  function showOnboarding() {
    cleanupActiveSequence();
    state.mode = "onboarding";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);
    void scene.applyViewPreset("onboarding", { reducedMotion: prefersReducedMotion() });
    scene.setPlayerLocation(state.save.profile?.location || state.save.onboarding?.draft?.location);

    try {
      activeSequenceCleanup = renderPlayerOnboardingSequence(dom.systemRoot, {
        save: state.save,
        onSave(nextSave) {
          state.save = saveLocalSave(nextSave);
          return state.save;
        },
        async onFeedback({ step, skipped, value, save: feedbackSave, source, signal, reducedMotion }) {
          if (skipped) {
            dom.systemRoot.classList.remove("has-world-feedback");
            delete dom.systemRoot.dataset.worldFeedback;
            return;
          }

          dom.systemRoot.dataset.worldFeedback = step;
          dom.systemRoot.classList.remove("has-world-feedback");
          void dom.systemRoot.offsetWidth;
          dom.systemRoot.classList.add("has-world-feedback");

          const location = step === "location"
            ? feedbackSave.onboarding?.draft?.location || value
            : feedbackSave.onboarding?.draft?.location;
          if (!location) {
            await delayWithSignal(reducedMotion ? 0 : 620, signal);
            return;
          }

          if (step === "location") {
            runtimeAudio.play("downlink");
            const handshake = await scene.establishPlayerSignal(location, {
              reducedMotion,
              mode: "entry",
              signal,
            });
            if (signal?.aborted || handshake.status !== "completed") return;
            runtimeAudio.play("confirmed");
          }

          if (step !== "location") {
            scene.pulsePlayerSignal({
              reducedMotion,
              duration: 850,
              variant: step === "player_name" ? "identity" : step,
            });
          }
          const removeLink = renderSignalLinkOverlay(dom.systemRoot, {
            source,
            variant: step === "main_quest" ? "quest" : "writeback",
            subscribe: (callback) => scene.subscribeLocationProjection(location, callback),
          });
          try {
            await delayWithSignal(reducedMotion ? 0 : (step === "location" ? 240 : 680), signal);
          } finally {
            removeLink();
            if (step === "location" && state.mode === "onboarding") {
              await scene.applyViewPreset("onboarding", { reducedMotion });
            }
          }
        },
        onComplete(nextSave) {
          state.save = nextSave;
          activeSequenceCleanup = null;
          showBroadcast({
            previousLastActiveAt: state.connectionSnapshot.previousLastActiveAt,
          });
        },
        onExit: exitToHome,
      });
    } catch (error) {
      showRuntimeError(error, {
        prefix: "玩家档案无法载入",
        onRetry: showOnboarding,
      });
    }
  }

  function showBroadcast({ previousLastActiveAt = null } = {}) {
    cleanupActiveSequence();
    state.mode = "broadcast";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);
    scene.setPlayerLocation(state.save.profile?.location);

    const shownAt = new Date().toISOString();
    const broadcast = resolveSystemBroadcast(state.save, {
      now: shownAt,
      previousLastActiveAt,
    });

    if (
      broadcast.type === "first_connection"
      && state.firstDaySequenceMode === FIRST_DAY_SEQUENCE_MODES.SEQUENCE
    ) {
      showFirstDaySequence({
        shownAt,
        previousLastActiveAt,
      });
      return;
    }

    if (broadcast.type === "first_connection" && state.save.profile?.location) {
      void scene.focusLocation(state.save.profile.location, {
        reducedMotion: prefersReducedMotion(),
        duration: 720,
      });
    } else {
      void scene.applyViewPreset("broadcast", { reducedMotion: prefersReducedMotion() });
    }

    try {
      activeSequenceCleanup = renderSystemBroadcast(dom.systemRoot, {
        broadcast,
        onAction(action) {
          if (state.mode !== "broadcast") return;
          if (action === "record_progress") {
            showQuiet({ initialChannel: "quest", questProgressOpen: true });
            return;
          }
          if (action === "view_main_quest") {
            showQuiet({ initialChannel: "quest" });
            return;
          }
          showQuiet();
        },
      });
      state.save = saveLocalSave(markBroadcastShown(state.save, shownAt));
      runtimeAudio.play("confirmed");
    } catch (error) {
      showRuntimeError(error, {
        prefix: "系统播报无法展示",
        onRetry: () => showBroadcast({ previousLastActiveAt }),
      });
    }
  }

  function showFirstDaySequence({
    shownAt = new Date().toISOString(),
    previousLastActiveAt = null,
  } = {}) {
    cleanupActiveSequence();
    state.mode = "first_day";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);

    const location = state.save?.profile?.location;
    if (!location) {
      showRuntimeError(new Error("玩家位置锚点不存在"), {
        prefix: "首日连接无法建立",
        onRetry: showOnboarding,
      });
      return;
    }

    scene.setPlayerLocation(location);
    void scene.focusLocation(location, {
      reducedMotion: prefersReducedMotion(),
      duration: 720,
    });

    const today = getLocalDateKey(new Date(shownAt));
    const preparedSave = ensureDailyRun(state.save, today);
    const view = buildFirstDaySequenceView(preparedSave, today);

    try {
      activeSequenceCleanup = renderFirstDayConnectionSequence(dom.systemRoot, {
        view,
        reducedMotion: prefersReducedMotion(),
        subscribe: (callback) => scene.subscribeLocationProjection(location, callback),
        pulseAnchor: (options) => scene.pulsePlayerSignal(options),
        onPresented() {
          if (state.mode !== "first_day") return;
          state.save = saveLocalSave(markBroadcastShown(preparedSave, shownAt));
        },
        onAchievement() {
          runtimeAudio.play("achievement");
        },
        onDailySignal() {
          runtimeAudio.play("daily");
        },
        onContinue() {
          if (state.mode === "first_day") showQuiet();
        },
        onError(error) {
          if (state.mode !== "first_day") return;
          showRuntimeError(error, {
            prefix: "首日连接无法展示",
            onRetry: () => showBroadcast({ previousLastActiveAt }),
          });
        },
      });
    } catch (error) {
      showRuntimeError(error, {
        prefix: "首日连接无法展示",
        onRetry: () => showBroadcast({ previousLastActiveAt }),
      });
    }
  }

  function showQuiet({ initialChannel = "", questProgressOpen = false } = {}) {
    cleanupActiveSequence();
    state.mode = "quiet";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);
    scene.setPlayerLocation(state.save.profile?.location);
    void scene.applyViewPreset("quiet", { reducedMotion: prefersReducedMotion() });

    activeSequenceCleanup = renderQuietRuntime(dom.systemRoot, {
      view: buildQuietRuntimeView({
        activeChannel: initialChannel,
        questProgressOpen,
      }),
      onRecordChange(text) {
        const today = getLocalDateKey();
        const prepared = ensureDailyRun(state.save, today);
        const existing = prepared.dailyRuns
          .find((run) => run?.date === today)?.freeRecord;
        const previousAchievements = state.save?.achievements;
        state.save = saveLocalSave(saveFreeRecord(prepared, today, {
          text,
          important: existing?.important === true,
        }));
        enqueueRuntimeAchievementNotices(previousAchievements, state.save?.achievements);

        return {
          message: existing
            ? "今日玩家记录已更新。"
            : "收到一条新的玩家记录。",
          view: buildQuietRuntimeView({ activeChannel: "record" }),
        };
      },
      onQuestAction(action, text) {
        if (action === "record_progress") {
          const today = getLocalDateKey();
          const prepared = refreshDailyMainAction(ensureDailyRun(state.save, today), today);
          state.save = saveLocalSave(recordAdditionalMainProgress(prepared, today, text));
          return {
            message: "主线进度已记录。",
            view: buildQuietRuntimeView({ activeChannel: "quest" }),
          };
        }

        if (action === "complete") {
          state.save = saveLocalSave(completeMainQuest(state.save));
          return {
            view: {
              ...buildQuietRuntimeView({ activeChannel: "quest" }),
              questFeedback: "主线已标记完成。",
            },
          };
        }

        if (action === "pause") {
          state.save = saveLocalSave(pauseMainQuest(state.save));
          return {
            view: {
              ...buildQuietRuntimeView({ activeChannel: "quest" }),
              questFeedback: "主线追踪已关闭。",
            },
          };
        }

        return null;
      },
      onOpenArchive() {
        openArchive({ returnMode: "quiet" });
      },
    });
  }

  function buildQuietRuntimeView({
    activeChannel = "",
    questProgressOpen = false,
  } = {}) {
    const today = getLocalDateKey();
    const run = state.save?.dailyRuns?.find((item) => item?.date === today);
    const quest = state.save?.mainQuest?.status === "active" ? state.save.mainQuest : null;
    const lastProgressAt = resolveCurrentMainQuestLastActivityAt(state.save);

    return {
      playerName: state.save?.profile?.nickname || "未命名玩家",
      activeChannel,
      questProgressOpen,
      record: {
        exists: Boolean(run?.freeRecord),
        text: run?.freeRecord?.text || "",
      },
      quest: quest ? {
        name: quest.title,
        lastProgressAt,
        lastProgressDistance: formatTimeDistance(lastProgressAt),
      } : null,
      archive: getFirstSignalArchiveView(state.save),
    };
  }

  function showInit() {
    cleanupActiveSequence();
    state.mode = "init";
    clearNightClasses();
    clearV04Classes();
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
    cleanupActiveSequence();
    state.mode = "panel";
    clearNightClasses();
    clearV04Classes();
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
      scene.setPlayerLocation(state.save.profile?.location);
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
      onOpenArchive() {
        openArchive({ returnMode: "panel" });
      },
      onExit: exitToHome,
    });
  }

  async function openArchive({ returnMode: requestedReturnMode = state.mode } = {}) {
    if (!["panel", "quiet"].includes(requestedReturnMode)) return;
    if (state.mode !== requestedReturnMode) return;

    const transitionId = ++state.transitionId;
    const now = new Date().toISOString();
    const dateKey = getLocalDateKey(new Date(now));
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    const archive = normalizeAchievementArchive(state.save?.achievementArchive);
    const duration = getNightTransitionDuration(archive, dateKey, reducedMotion);

    state.archiveReturnMode = requestedReturnMode;
    cleanupActiveSequence();
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
      runtimeAudio.play("archive");
      showArchiveOrReview();
    } catch (error) {
      if (transitionId !== state.transitionId) return;
      dom.systemRoot.classList.remove("is-transitioning-night", "is-night");
      scene.toDay(250).catch?.(() => {});
      showArchiveReturnTarget();
    }
  }

  async function returnToDay() {
    if (!["archive", "archive-review", "archive-ceremony", "first-signal-archive"].includes(state.mode)) return;

    const transitionId = ++state.transitionId;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
    state.mode = "transitioning-day";
    dom.systemRoot.classList.add("is-transitioning-day");

    try {
      await scene.toDay(reducedMotion ? 250 : 700);
      if (transitionId !== state.transitionId) return;
      clearNightClasses();
      showArchiveReturnTarget();
    } catch (error) {
      if (transitionId !== state.transitionId) return;
      clearNightClasses();
      showArchiveReturnTarget();
    }
  }

  function showArchiveReturnTarget() {
    const returnMode = state.archiveReturnMode;
    state.archiveReturnMode = null;

    if (returnMode === "quiet" && state.experienceMode === EXPERIENCE_MODES.V04) {
      showQuiet();
      return;
    }

    showPanel();
  }

  function showArchiveOrReview() {
    if (state.experienceMode === EXPERIENCE_MODES.V04 && state.archiveReturnMode === "quiet") {
      showFirstSignalArchive();
      return;
    }

    const archive = normalizeAchievementArchive(state.save?.achievementArchive);
    if (archive.scanStatus === "complete") {
      showArchive();
    } else {
      showOldSaveReview();
    }
  }

  function showFirstSignalArchive() {
    cleanupActiveSequence();
    state.mode = "first-signal-archive";
    dom.systemRoot.classList.remove("is-transitioning-night", "is-transitioning-day");
    dom.systemRoot.classList.add("is-night");
    setSystemVisible(dom.systemRoot, true);

    const presenter = renderFirstSignalArchive(dom.systemRoot, {
      save: state.save,
      playerName: state.save?.profile?.nickname,
      reducedMotion: prefersReducedMotion(),
      onConfirm() {
        state.save = saveLocalSave(confirmFirstSignalRecord(state.save));
        runtimeAudio.play("confirmed");
      },
      onReturn: returnToDay,
    });
    activeSequenceCleanup = presenter.destroy;
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
    if (state.mode === "panel") openArchive({ returnMode: "panel" });
    if (state.mode === "quiet") openArchive({ returnMode: "quiet" });
    if (
      state.mode === "archive"
      || state.mode === "archive-review"
      || state.mode === "first-signal-archive"
    ) returnToDay();
  }

  function clearNightClasses() {
    dom.systemRoot.classList.remove("is-night", "is-transitioning-night", "is-transitioning-day");
  }

  function clearV04Classes() {
    dom.systemRoot.classList.remove(
      "is-connection",
      "is-onboarding",
      "is-broadcast",
      "is-first-day",
      "is-quiet",
      "has-world-feedback",
    );
    delete dom.systemRoot.dataset.worldFeedback;
  }

  function cleanupActiveSequence() {
    const cleanup = activeSequenceCleanup;
    activeSequenceCleanup = null;
    cleanup?.();
    scene.abortPlayerSignalHandshake();
  }

  function routeThroughLegacyExperience() {
    if (state.save.profile) {
      showPanel();
    } else {
      showInit();
    }
  }

  function showConnectionFailure(presenter, error, prefix) {
    const message = error instanceof Error ? error.message : String(error || "未知错误");
    presenter?.show({
      id: "connection_error",
      tone: "error",
      text: `${prefix}：${message}`,
      actions: [
        { id: "retry", label: "重试" },
        { id: "return_home", label: "返回首页" },
      ],
    });
  }

  function showRuntimeError(error, {
    prefix = "运行状态异常",
    onRetry = showConnection,
  } = {}) {
    cleanupActiveSequence();
    state.mode = "runtime_error";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);

    const presenter = renderEarthConnectionSequence(dom.systemRoot, {
      reducedMotion: prefersReducedMotion(),
      onAction(action) {
        if (action === "retry") onRetry();
        if (action === "return_home") exitToHome();
      },
    });
    activeSequenceCleanup = presenter.cleanup;
    showConnectionFailure(presenter, error, prefix);
  }

  function prefersReducedMotion() {
    return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;
  }

  function delayWithSignal(duration, signal) {
    if (signal?.aborted || duration <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = setTimeout(finish, duration);
      signal?.addEventListener("abort", finish, { once: true });
      function finish() {
        clearTimeout(timer);
        signal?.removeEventListener("abort", finish);
        resolve();
      }
    });
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
    cleanupActiveSequence();
    scene.skipTransition();
    state.mode = "home";
    clearNightClasses();
    clearV04Classes();
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, false);
    showHomeOverlay();
    dom.body.classList.remove("is-zooming");
    scene.home();
  }

  dom.stage.addEventListener("dblclick", enter);
  dom.homeOverlay.addEventListener("click", (event) => {
    if (event.target?.closest?.("[data-home-action='enter']")) {
      void enter();
    }
  });
  window.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (state.mode === "transitioning-night" || state.mode === "transitioning-day") {
      skipActiveTransition();
      return;
    }
    if (
      state.mode === "archive"
      || state.mode === "archive-review"
      || state.mode === "first-signal-archive"
    ) {
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
      scene.setPlayerLocation(state.save.profile?.location);
      if (state.experienceMode === EXPERIENCE_MODES.V04) {
        state.connectionSnapshot = captureConnectionSnapshot(state.save);
        const route = resolvePostConnectionRoute(state.experienceMode, state.save);
        if (route === RUNTIME_ROUTES.BROADCAST) {
          showBroadcast({
            previousLastActiveAt: state.connectionSnapshot.previousLastActiveAt,
          });
        } else {
          showOnboarding();
        }
      } else {
        showPanel();
      }
    } catch (error) {
      if (state.experienceMode === EXPERIENCE_MODES.V04) {
        showRuntimeError(error, {
          prefix: "存档导入失败",
          onRetry: showQuiet,
        });
      } else {
        dom.systemRoot.dataset.systemMessage = error?.message || "Save import failed";
        showPanel();
      }
    }
  });

  renderHome(dom.homeOverlay);
  setSystemVisible(dom.systemRoot, false);
  scene.start();
  void scene.applyInitialFraming({
    reducedMotion: prefersReducedMotion(),
    duration: prefersReducedMotion() ? 0 : 900,
  });

  return {
    enter,
    exitToHome,
    handleDayNightControl,
    openArchive,
    returnToDay,
    state,
  };
}
