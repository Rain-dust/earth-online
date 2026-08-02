import {
  ACHIEVEMENT_CATALOG,
  getAchievementDefinition,
  getRarityTier,
} from "../core/achievement-catalog.mjs";
import {
  getAchievementInstanceId,
  normalizeAchievementArchive,
} from "../core/achievements.mjs";

const ACTION_SETTLE_MS = 260;

export function buildOldSaveSignalReview(save, { seenIds = [] } = {}) {
  const archive = normalizeAchievementArchive(save?.achievementArchive);
  const confirmed = new Set(
    (Array.isArray(save?.achievements) ? save.achievements : [])
      .map(getAchievementInstanceId)
      .filter(Boolean),
  );
  const rejected = new Set(archive.rejectedIds);
  const deferred = new Set(archive.dismissedIds);
  const seen = new Set(normalizeIds(seenIds));
  const candidateOrder = new Map(archive.candidateIds.map((id, index) => [id, index]));
  const unresolved = ACHIEVEMENT_CATALOG
    .filter((item) => !confirmed.has(item.id) && !rejected.has(item.id))
    .sort((left, right) => {
      const leftCandidate = candidateOrder.has(left.id);
      const rightCandidate = candidateOrder.has(right.id);
      if (leftCandidate !== rightCandidate) return leftCandidate ? -1 : 1;
      if (leftCandidate) return candidateOrder.get(left.id) - candidateOrder.get(right.id);
      if (deferred.has(left.id) !== deferred.has(right.id)) return deferred.has(left.id) ? 1 : -1;
      return ACHIEVEMENT_CATALOG.indexOf(left) - ACHIEVEMENT_CATALOG.indexOf(right);
    });
  const item = unresolved.find((entry) => !seen.has(entry.id)) || null;
  const resolvedCount = ACHIEVEMENT_CATALOG.length - unresolved.length;
  const reviewed = new Set([...confirmed, ...rejected, ...seen]);

  return {
    item: item
      ? {
          ...item,
          rarityTier: getRarityTier(item.rarityPercent),
          strongSignal: candidateOrder.has(item.id),
          deferred: deferred.has(item.id),
        }
      : null,
    totalCount: ACHIEVEMENT_CATALOG.length,
    resolvedCount,
    reviewedCount: ACHIEVEMENT_CATALOG.filter((entry) => reviewed.has(entry.id)).length,
    sessionCount: seen.size,
    remainingCount: unresolved.length,
    deferredCount: unresolved.filter((entry) => deferred.has(entry.id)).length,
    allResolved: unresolved.length === 0,
  };
}

export function renderOldSaveSignalReview(root, {
  save,
  seenIds = [],
  reducedMotion = false,
  onConfirm,
  onReject,
  onDefer,
  onFinish,
  onExit,
} = {}) {
  const view = buildOldSaveSignalReview(save, { seenIds });
  const documentRef = root?.ownerDocument || document;
  const surface = documentRef.createElement("section");
  let active = true;
  let actionTimer = null;

  surface.className = "old-save-signal-review";
  surface.setAttribute("aria-label", view.item ? "旧存档信号确认" : "旧存档扫描结果");
  surface.innerHTML = view.item ? renderSignal(view) : renderSummary(view);
  root.replaceChildren(surface);

  surface.querySelector("[data-signal-action='exit']")?.addEventListener("click", () => {
    if (active) onExit?.();
  });
  surface.querySelector("[data-signal-action='finish']")?.addEventListener("click", () => {
    if (active) onFinish?.(view);
  });

  for (const button of surface.querySelectorAll("[data-review-action]")) {
    button.addEventListener("click", () => {
      if (!active || actionTimer !== null || !view.item) return;
      const action = button.dataset.reviewAction;
      surface.dataset.resolution = action;
      surface.classList.add("is-resolving");
      actionTimer = setTimeout(() => {
        actionTimer = null;
        if (!active) return;
        if (action === "confirm") onConfirm?.(view.item.id);
        if (action === "reject") onReject?.(view.item.id);
        if (action === "defer") onDefer?.(view.item.id);
      }, reducedMotion ? 0 : ACTION_SETTLE_MS);
    });
  }

  return {
    element: surface,
    view,
    destroy() {
      active = false;
      if (actionTimer !== null) {
        clearTimeout(actionTimer);
        actionTimer = null;
      }
    },
  };
}

function renderSignal(view) {
  const item = view.item;
  const current = Math.min(view.totalCount, view.reviewedCount + 1);

  return `
    <button class="signal-review-exit" type="button" data-signal-action="exit" aria-label="结束本轮扫描" title="结束本轮扫描">×</button>
    <div class="signal-review-progress" aria-label="旧存档恢复进度">
      <span>OLD SAVE SIGNAL</span>
      <strong>${pad(current)} / ${pad(view.totalCount)}</strong>
    </div>
    <div class="signal-review-art" data-rarity="${escapeHtml(item.rarityTier.id)}" aria-hidden="true">
      <img src="${escapeHtml(item.iconAsset)}" alt="" width="360" height="360" decoding="async" />
      <span class="signal-review-link"></span>
    </div>
    <article class="signal-review-copy">
      <p>${item.strongSignal ? "检测到强关联记录" : item.deferred ? "暂存信号重新出现" : "检测到旧存档片段"}</p>
      <h2>${escapeHtml(item.title)}</h2>
      <div class="signal-review-description">${escapeHtml(item.description)}</div>
      <small>${escapeHtml(formatPercent(item.rarityPercent))} 的玩家拥有此成就</small>
      <div class="signal-review-actions" aria-label="确认这条旧存档">
        ${renderAction("confirm", "✓", "属于我")}
        ${renderAction("reject", "×", "不属于我")}
        ${renderAction("defer", "?", "暂不确认")}
      </div>
    </article>
  `;
}

function renderSummary(view) {
  const summary = view.allResolved
    ? "旧存档扫描已经完成。"
    : `本轮信号读取结束，仍有 ${view.remainingCount} 条记录等待确认。`;
  const detail = view.allResolved
    ? `共处理 ${view.totalCount} 条人生记录。`
    : view.deferredCount > 0
      ? `其中 ${view.deferredCount} 条已暂存，系统会在以后重新询问。`
      : "你可以在以后重新进入夜间档案。";

  return `
    <div class="signal-review-summary">
      <p>OLD SAVE SCAN</p>
      <h2>${escapeHtml(summary)}</h2>
      <span>${escapeHtml(detail)}</span>
      <button type="button" data-signal-action="finish">结束本轮扫描</button>
    </div>
  `;
}

function renderAction(action, symbol, label) {
  return `
    <button
      type="button"
      data-review-action="${action}"
      aria-label="${label}"
      title="${label}"
    >
      <strong aria-hidden="true">${symbol}</strong>
      <span>${label}</span>
    </button>
  `;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id) => getAchievementDefinition(id)).map(String))];
}

function formatPercent(value) {
  const number = Number(value);
  return `${Number.isInteger(number) ? number : number.toFixed(1)}%`;
}

function pad(value) {
  return String(Math.max(0, Number(value) || 0)).padStart(2, "0");
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
