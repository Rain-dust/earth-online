export function buildMainQuestDialogView(save) {
  const quest = save?.mainQuest?.status === "active" ? save.mainQuest : null;

  if (!quest) {
    return {
      mode: "empty",
      title: "设定当前主线",
      fields: [
        { name: "title", label: "主线", value: "", placeholder: "现在最想推进的一件事" },
        { name: "firstAction", label: "下一步", value: "", placeholder: "今天能完成的最小一步" },
      ],
      actions: ["create", "close"],
    };
  }

  return {
    mode: "active",
    title: quest.title,
    fields: [{
      name: "currentAction",
      label: "当前行动",
      value: quest.currentAction?.text || "",
      placeholder: "今天能完成的最小一步",
    }],
    actions: ["saveAction", "pause", "complete", "switch", "abandon", "close"],
  };
}

export function openMainQuestDialog(root, {
  save,
  onCreate,
  onSaveAction,
  onPause,
  onComplete,
  onSwitch,
  onAbandon,
  onClose,
} = {}) {
  const backdrop = document.createElement("div");
  backdrop.className = "quest-dialog-backdrop";
  let mode = buildMainQuestDialogView(save).mode;
  let confirmAction = null;

  const close = () => {
    backdrop.remove();
    onClose?.();
  };

  const render = () => {
    const view = mode === "switch"
      ? { ...buildMainQuestDialogView({ mainQuest: null }), mode: "switch", title: "切换主线" }
      : buildMainQuestDialogView(save);

    backdrop.innerHTML = `
      <section class="quest-dialog" role="dialog" aria-modal="true" aria-labelledby="quest-dialog-title">
        <header>
          <div>
            <span>MAIN QUEST</span>
            <h2 id="quest-dialog-title">${escapeHtml(view.title)}</h2>
          </div>
          <button class="icon-button" type="button" data-quest-action="close" aria-label="关闭主线面板" title="关闭">
            <i data-lucide="x" aria-hidden="true"></i>
          </button>
        </header>
        <form class="quest-dialog-form">
          ${view.fields.map(renderField).join("")}
          <p class="quest-form-error" role="alert" hidden></p>
          <div class="quest-dialog-actions">
            ${renderActions(view.mode, confirmAction)}
          </div>
        </form>
      </section>
    `;

    const form = backdrop.querySelector("form");
    const error = backdrop.querySelector(".quest-form-error");

    backdrop.querySelector("[data-quest-action='close']").addEventListener("click", close);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);

      try {
        if (view.mode === "empty") {
          onCreate?.({ title: data.get("title"), firstAction: data.get("firstAction") });
        } else if (view.mode === "switch") {
          onSwitch?.({ title: data.get("title"), firstAction: data.get("firstAction") });
        } else {
          onSaveAction?.(data.get("currentAction"));
        }
        close();
      } catch (caught) {
        error.textContent = caught?.message || "主线写入失败";
        error.hidden = false;
      }
    });

    for (const button of backdrop.querySelectorAll("[data-secondary-action]")) {
      button.addEventListener("click", () => {
        const action = button.dataset.secondaryAction;

        if (action === "switch") {
          mode = "switch";
          confirmAction = null;
          render();
          return;
        }

        if (["abandon", "complete"].includes(action) && confirmAction !== action) {
          confirmAction = action;
          render();
          return;
        }

        ({ pause: onPause, complete: onComplete, abandon: onAbandon })[action]?.();
        close();
      });
    }

    globalThis.lucide?.createIcons({ root: backdrop });
    backdrop.querySelector("input")?.focus();
  };

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.addEventListener("keydown", (event) => {
    handleQuestDialogKeydown(event, close);
  });

  root.append(backdrop);
  render();
  return { close };
}

export function handleQuestDialogKeydown(event, close) {
  if (event?.key !== "Escape") return false;

  event.preventDefault?.();
  event.stopPropagation?.();
  close?.();
  return true;
}

function renderField(field) {
  return `
    <label>
      <span>${escapeHtml(field.label)}</span>
      <input name="${escapeHtml(field.name)}" value="${escapeHtml(field.value)}" placeholder="${escapeHtml(field.placeholder)}" required maxlength="80" />
    </label>
  `;
}

function renderActions(mode, confirmAction) {
  if (mode === "empty" || mode === "switch") {
    return `<button class="quest-primary-action" type="submit">${mode === "switch" ? "确认切换" : "启动主线"}</button>`;
  }

  return `
    <button type="button" data-secondary-action="pause">暂停</button>
    <button type="button" data-secondary-action="switch">切换</button>
    <button type="button" data-secondary-action="complete">${confirmAction === "complete" ? "确认完成" : "完成主线"}</button>
    <button class="quest-danger-action" type="button" data-secondary-action="abandon">${confirmAction === "abandon" ? "确认放弃" : "放弃"}</button>
    <button class="quest-primary-action" type="submit">保存行动</button>
  `;
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
