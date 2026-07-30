import {
  FIRST_SIGNAL_RECORD_ID,
  getFirstSignalArchiveView,
} from "../core/first-signal-archive.mjs";

export const FIRST_SIGNAL_CONFIRMATION_DURATION = 2200;

export function getFirstSignalConfirmationDuration(reducedMotion = false) {
  return reducedMotion ? 0 : FIRST_SIGNAL_CONFIRMATION_DURATION;
}

export function getFirstSignalArchiveMarkup(save, { playerName = "玩家" } = {}) {
  return renderArchive(
    getFirstSignalArchiveView(save),
    normalizePlayerName(playerName),
  );
}

export function renderFirstSignalArchive(root, {
  save,
  playerName = "玩家",
  reducedMotion,
  onConfirm,
  onReturn,
} = {}) {
  const documentRef = root?.ownerDocument || document;
  const view = getFirstSignalArchiveView(save);
  const panel = documentRef.createElement("section");
  const name = normalizePlayerName(playerName);
  const motionReduced = reducedMotion ?? documentRef.defaultView
    ?.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  let active = true;
  let returnTimer = null;
  let confirmationStarted = false;

  panel.className = "first-signal-archive";
  panel.setAttribute("aria-label", "第一条旧存档");
  panel.dataset.firstSignalArchive = "";
  panel.dataset.recordId = FIRST_SIGNAL_RECORD_ID;
  panel.dataset.recordState = view.status;
  panel.innerHTML = renderArchiveContent(view, name);
  root.replaceChildren(panel);

  panel.querySelector("[data-first-signal-action='return']")?.addEventListener("click", () => {
    if (active) onReturn?.();
  });
  panel.querySelector("[data-first-signal-action='confirm']")?.addEventListener("click", () => {
    if (!active || confirmationStarted) return;
    confirmationStarted = true;

    const recoveredView = {
      ...view,
      status: "recovered",
      recovered: true,
      record: { ...view.record, status: "recovered" },
    };
    panel.dataset.recordState = "recovered";
    panel.classList.add("is-confirming");
    panel.innerHTML = renderArchiveContent(recoveredView, name);
    onConfirm?.(FIRST_SIGNAL_RECORD_ID);

    returnTimer = setTimeout(() => {
      returnTimer = null;
      if (active) onReturn?.();
    }, getFirstSignalConfirmationDuration(motionReduced));
  });

  return {
    element: panel,
    destroy() {
      active = false;
      if (returnTimer !== null) {
        clearTimeout(returnTimer);
        returnTimer = null;
      }
      panel.classList.remove("is-confirming");
    },
  };
}

function renderArchive(view, playerName) {
  return `
    <section
      class="first-signal-archive"
      aria-label="第一条旧存档"
      data-first-signal-archive
      data-record-id="${FIRST_SIGNAL_RECORD_ID}"
      data-record-state="${view.status}"
    >
      ${renderArchiveContent(view, playerName)}
    </section>
  `;
}

function renderArchiveContent(view, playerName) {
  return `
    <div class="first-signal-visual" aria-hidden="true" data-first-signal-image-slot>
      <img
        src="${view.imageAsset}"
        alt=""
        width="320"
        height="320"
        decoding="async"
        data-first-signal-image
      />
      <span class="first-signal-line"></span>
    </div>
    <div class="first-signal-copy" data-first-signal-state="${view.status}">
      ${view.recovered ? `
        <p class="first-signal-kicker">旧存档已恢复</p>
        <h2>原来我做到了</h2>
        <p class="first-signal-message">${escapeHtml(playerName)}，你曾经做到过。</p>
        <small>此记录由你确认</small>
      ` : `
        <p class="first-signal-kicker">待确认旧存档</p>
        <h2>你完成过一件曾以为做不到的事吗？</h2>
        <div class="first-signal-actions">
          <button type="button" data-first-signal-action="confirm">有，恢复这条</button>
          <button type="button" data-first-signal-action="return">暂不恢复</button>
        </div>
      `}
    </div>
  `;
}

function normalizePlayerName(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "玩家";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
