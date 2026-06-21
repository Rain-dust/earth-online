import {
  downloadSaveJson,
  importSave,
  loadLocalSave,
  readSaveFile,
  saveLocalSave,
} from "../core/storage.mjs";
import { createEarthScene } from "../scene/earth-scene.mjs";
import { renderHome } from "../ui/home.mjs";
import { renderInitTerminal } from "../ui/init-terminal.mjs";
import { renderSystemPanel } from "../ui/system-panel.mjs";
import { getDom, setSystemVisible } from "./dom.mjs";

export function createApp() {
  const dom = getDom();
  const save = loadLocalSave();
  const scene = createEarthScene(dom.stage);
  const state = { mode: "home", save, scene };
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

  function showPanel({ persistGeneratedTasks = true } = {}) {
    state.mode = "panel";
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, true);

    const handleChange = (nextSave) => {
      state.save = saveLocalSave(nextSave);
      renderPanel(handleChange);
    };

    renderPanel(handleChange, { persistGeneratedTasks });
  }

  function renderPanel(handleChange, { persistGeneratedTasks = true } = {}) {
    dom.systemRoot.replaceChildren();
    renderSystemPanel(dom.systemRoot, {
      save: state.save,
      onChange: handleChange,
      onExit: exitToHome,
      persistGeneratedTasks,
    });
  }

  function exitToHome() {
    focusAttemptId += 1;
    state.mode = "home";
    dom.systemRoot.replaceChildren();
    setSystemVisible(dom.systemRoot, false);
    showHomeOverlay();
    dom.body.classList.remove("is-zooming");
    scene.home();
  }

  dom.stage.addEventListener("dblclick", enter);
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      exitToHome();
    }
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

  return { enter, exitToHome, state };
}
