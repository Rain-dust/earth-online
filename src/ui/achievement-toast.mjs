import { getAchievementDefinition } from "../core/achievement-catalog.mjs";
import { getAchievementInstanceId } from "../core/achievements.mjs";

export function getNewAchievementIds(previous = [], next = []) {
  const known = new Set(asArray(previous).map(getAchievementInstanceId).filter(Boolean));
  const added = [];

  for (const instance of asArray(next)) {
    const id = getAchievementInstanceId(instance);
    if (!id || known.has(id) || added.includes(id)) continue;
    added.push(id);
  }
  return added;
}

export function createAchievementToastQueue({ show }) {
  let tail = Promise.resolve();

  return {
    enqueue(id) {
      const run = tail.catch(() => {}).then(() => show(id));
      tail = run.catch(() => {});
      return run;
    },
  };
}

export function showAchievementToast(root, {
  id,
  instance,
  duration = 3500,
} = {}) {
  const definition = getAchievementDefinition(id);
  const title = definition?.title || instance?.label || "新的记录";
  const description = definition?.description || "一段新的经历已写入夜间档案馆。";
  const toast = document.createElement("aside");

  toast.className = "achievement-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">
      ${definition
        ? `<img src="${escapeHtml(definition.iconAsset)}" alt="" width="52" height="52" decoding="async" />`
        : '<span class="toast-archive-glyph">◇</span>'}
    </span>
    <span class="toast-copy">
      <small>人生记录已收录</small>
      <strong>${escapeHtml(title)}</strong>
      <span>${escapeHtml(description)}</span>
    </span>
    <button type="button" aria-label="关闭成就通知" title="关闭">×</button>
  `;
  root.append(toast);

  return new Promise((resolve) => {
    let settled = false;
    const close = () => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout?.(timer);
      toast.classList.add("is-leaving");
      globalThis.setTimeout?.(() => {
        toast.remove();
        resolve();
      }, 180);
    };
    const timer = globalThis.setTimeout?.(close, Math.max(0, Number(duration) || 0));
    toast.querySelector("button")?.addEventListener("click", close);
  });
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
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
