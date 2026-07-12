import {
  ACHIEVEMENT_CATALOG,
  getAchievementDefinition,
  getRarityTier,
} from "../core/achievement-catalog.mjs";
import {
  getAchievementInstanceId,
  normalizeAchievementArchive,
} from "../core/achievements.mjs";

const CATEGORY_LABELS = Object.freeze({
  learning: "成长与学习",
  exploration: "地图探索",
  skills: "技能与热爱",
  relationships: "关系与羁绊",
  career: "职业主线",
  growth: "运行恢复",
  resources: "资源系统",
});

export function buildOldSaveReview(save) {
  const archive = normalizeAchievementArchive(save?.achievementArchive);
  const confirmed = collectConfirmed(save?.achievements);
  const dismissed = new Set(archive.dismissedIds);
  const candidateIds = archive.candidateIds.filter((id) => getAchievementDefinition(id));
  const candidateSet = new Set(candidateIds);
  const candidates = candidateIds.map((id) => buildReviewItem(
    getAchievementDefinition(id),
    confirmed.get(id),
    dismissed.has(id),
    true,
  ));
  const catalog = ACHIEVEMENT_CATALOG
    .filter((definition) => !candidateSet.has(definition.id))
    .map((definition) => buildReviewItem(
      definition,
      confirmed.get(definition.id),
      dismissed.has(definition.id),
      false,
    ));

  return {
    archive,
    candidates,
    catalog,
    groups: groupDefinitionsByCategory(catalog),
    confirmedCount: new Set(
      ACHIEVEMENT_CATALOG
        .filter((definition) => confirmed.has(definition.id))
        .map((definition) => definition.id),
    ).size,
  };
}

export function getRecoveryCeremony(save) {
  const recovery = normalizeAchievementArchive(save?.achievementArchive).lastRecovery;
  if (!recovery || !Number.isInteger(recovery.count) || recovery.count < 0) {
    return null;
  }

  const representative = getAchievementDefinition(recovery.representativeId);
  const remainingCount = Number.isInteger(recovery.remainingCount) && recovery.remainingCount >= 0
    ? recovery.remainingCount
    : Math.max(0, recovery.count - (representative ? 1 : 0));

  return {
    at: typeof recovery.at === "string" ? recovery.at : null,
    count: recovery.count,
    remainingCount,
    representative: representative
      ? { ...representative, rarityTier: getRarityTier(representative.rarityPercent) }
      : null,
    summary: `旧存档已恢复，新增 ${recovery.count} 项人生记录`,
  };
}

export function renderOldSaveReview(root, {
  save,
  onConfirm,
  onDismiss,
  onRestoreDismissed,
  onRevoke,
  onComplete,
  onReturnArchive,
} = {}) {
  const view = buildOldSaveReview(save);
  const panel = document.createElement("section");

  panel.className = "old-save-review";
  panel.setAttribute("aria-label", "旧存档记录确认");
  panel.innerHTML = renderReviewShell(view);
  root.replaceChildren(panel);

  panel.querySelector("[data-action='return-archive']")?.addEventListener("click", () => {
    onReturnArchive?.();
  });
  panel.querySelector("[data-action='complete-review']")?.addEventListener("click", () => {
    onComplete?.();
  });
  for (const button of panel.querySelectorAll("button[data-review-action]")) {
    button.addEventListener("click", () => {
      const id = button.dataset.achievementId;
      const action = button.dataset.reviewAction;
      if (action === "confirm") onConfirm?.(id);
      if (action === "dismiss") onDismiss?.(id);
      if (action === "restore") onRestoreDismissed?.(id);
      if (action === "revoke") onRevoke?.(id);
    });
  }
}

export function renderRecoveryCeremony(root, {
  save,
  onClose,
  onSkip,
} = {}) {
  const ceremony = getRecoveryCeremony(save);
  if (!ceremony) {
    onClose?.();
    return;
  }

  const panel = document.createElement("section");
  panel.className = "recovery-ceremony";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "旧存档恢复完成");
  panel.innerHTML = renderCeremonyShell(ceremony);
  root.replaceChildren(panel);

  panel.querySelector("[data-action='skip-ceremony']")?.addEventListener("click", () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose?.();
    }
  });
  panel.querySelector("[data-action='close-ceremony']")?.addEventListener("click", () => {
    onClose?.();
  });
  panel.querySelector("[data-action='close-ceremony']")?.focus();
}

function collectConfirmed(value) {
  const byId = new Map();
  const instances = Array.isArray(value) ? value : [];

  for (const instance of instances) {
    const id = getAchievementInstanceId(instance);
    if (!getAchievementDefinition(id)) continue;
    const current = byId.get(id);
    byId.set(id, {
      instance: current?.instance || instance,
      hidden: current?.hidden === true || instance?.hidden === true,
    });
  }
  return byId;
}

function buildReviewItem(definition, confirmed, dismissed, candidate) {
  return {
    ...definition,
    rarityTier: getRarityTier(definition.rarityPercent),
    candidate,
    hidden: confirmed?.hidden === true,
    status: confirmed ? "confirmed" : dismissed ? "dismissed" : "available",
  };
}

function groupDefinitionsByCategory(items) {
  const groups = new Map();
  for (const item of items) {
    if (!groups.has(item.category)) {
      groups.set(item.category, {
        id: item.category,
        label: CATEGORY_LABELS[item.category] || "人生记录",
        items: [],
      });
    }
    groups.get(item.category).items.push(item);
  }
  return [...groups.values()];
}

function renderReviewShell(view) {
  return `
    <header class="archive-topbar review-topbar">
      <div class="archive-brand">
        <span class="archive-brand-mark" aria-hidden="true"></span>
        <strong>旧存档扫描</strong>
        <span>由你确认，不要求证明</span>
      </div>
      <button class="archive-icon-button" type="button" data-action="return-archive" aria-label="返回夜间档案馆" title="返回夜间档案馆">←</button>
    </header>
    <div class="review-scroll">
      <header class="review-heading">
        <span class="archive-kicker">LOCAL ARCHIVE / MANUAL REVIEW</span>
        <h2>发现若干条可能存在的历史记录</h2>
        <p>系统只负责提出线索，是否收录由你决定。</p>
      </header>

      <section class="review-section" aria-labelledby="candidate-heading">
        <div class="review-section-heading">
          <div>
            <span class="archive-kicker">STRONG SIGNALS</span>
            <h3 id="candidate-heading">扫描候选</h3>
          </div>
          <span>${view.candidates.length} 项</span>
        </div>
        <div class="review-list">
          ${view.candidates.length
            ? view.candidates.map(renderReviewRow).join("")
            : '<p class="review-empty">没有发现强信号候选，可以继续从完整图鉴补录。</p>'}
        </div>
      </section>

      <section class="review-section" aria-labelledby="catalog-heading">
        <div class="review-section-heading">
          <div>
            <span class="archive-kicker">MANUAL RECOVERY</span>
            <h3 id="catalog-heading">补录未发现记录</h3>
          </div>
          <span>${view.catalog.length} 项</span>
        </div>
        ${view.groups.map((group) => `
          <section class="review-chapter" aria-labelledby="chapter-${escapeHtml(group.id)}">
            <h4 id="chapter-${escapeHtml(group.id)}">${escapeHtml(group.label)}</h4>
            <div class="review-list">${group.items.map(renderReviewRow).join("")}</div>
          </section>
        `).join("")}
      </section>
    </div>
    <footer class="review-footer">
      <span>当前已确认 <strong>${view.confirmedCount}</strong> 项</span>
      <button class="review-primary" type="button" data-action="complete-review">完成补录</button>
    </footer>
  `;
}

function renderReviewRow(item) {
  const statusLabel = item.status === "confirmed"
    ? item.hidden ? "已收录 · 已隐藏" : "已收录"
    : item.status === "dismissed" ? "暂不收录" : "等待确认";

  return `
    <article class="review-row" data-status="${item.status}" data-rarity="${escapeHtml(item.rarityTier.id)}">
      <img src="${escapeHtml(item.iconAsset)}" alt="" width="58" height="58" loading="lazy" decoding="async" />
      <div class="review-copy">
        <span>${escapeHtml(CATEGORY_LABELS[item.category] || "人生记录")}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.description)}</small>
      </div>
      <span class="review-status">${statusLabel}</span>
      <div class="review-actions">${renderReviewActions(item)}</div>
    </article>
  `;
}

function renderReviewActions(item) {
  if (item.status === "confirmed") {
    return `<button type="button" data-review-action="revoke" data-achievement-id="${escapeHtml(item.id)}">撤销</button>`;
  }
  if (item.status === "dismissed") {
    return `<button type="button" data-review-action="restore" data-achievement-id="${escapeHtml(item.id)}">重新考虑</button>`;
  }
  return `
    <button type="button" data-review-action="dismiss" data-achievement-id="${escapeHtml(item.id)}">暂不收录</button>
    <button class="is-primary" type="button" data-review-action="confirm" data-achievement-id="${escapeHtml(item.id)}">确认收录</button>
  `;
}

function renderCeremonyShell(ceremony) {
  const representative = ceremony.representative;
  return `
    <button class="ceremony-skip" type="button" data-action="skip-ceremony">跳过动画</button>
    <div class="ceremony-stage ${representative ? "has-representative" : ""}">
      ${representative ? `
        <div class="ceremony-signal" aria-hidden="true"></div>
        <div class="ceremony-icon" data-rarity="${escapeHtml(representative.rarityTier.id)}">
          <img src="${escapeHtml(representative.iconAsset)}" alt="" width="180" height="180" decoding="async" />
        </div>
        <span class="archive-kicker">代表记录 · ${escapeHtml(representative.rarityTier.label)}</span>
        <h2>${escapeHtml(representative.title)}</h2>
        <p>${escapeHtml(representative.description)}</p>
      ` : `
        <span class="archive-kicker">PRIVATE RECOVERY</span>
        <h2>记录已静默归档</h2>
      `}
      <div class="recovery-stack" aria-hidden="true"><span></span><span></span><span></span></div>
      <strong class="ceremony-summary">${escapeHtml(ceremony.summary)}</strong>
      ${ceremony.remainingCount > 0 ? `<small>另有 ${ceremony.remainingCount} 项已归入夜间档案馆</small>` : ""}
      <button class="review-primary" type="button" data-action="close-ceremony">返回档案馆</button>
    </div>
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
