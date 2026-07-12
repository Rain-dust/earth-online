import {
  ACHIEVEMENT_CATALOG,
  getAchievementDefinition,
  getRarityTier,
} from "../core/achievement-catalog.mjs";
import { getAchievementInstanceId } from "../core/achievements.mjs";

const FILTERS = Object.freeze([
  ["all", "全部"],
  ["confirmed", "已收录"],
  ["unconfirmed", "未收录"],
  ["hidden", "隐藏"],
]);

const CATEGORY_LABELS = Object.freeze({
  learning: "成长与学习",
  exploration: "地图探索",
  skills: "技能与热爱",
  relationships: "关系与羁绊",
  career: "职业主线",
  growth: "运行恢复",
  resources: "资源系统",
});

export function buildArchiveView(save, filter = "all") {
  const instances = collectKnownInstances(save?.achievements);
  const items = ACHIEVEMENT_CATALOG.map((definition) => {
    const aggregate = instances.get(definition.id) || null;

    return {
      ...definition,
      instance: aggregate?.instance || null,
      confirmed: Boolean(aggregate),
      hidden: Boolean(aggregate?.hidden),
      rarityTier: getRarityTier(definition.rarityPercent),
    };
  });

  if (filter === "confirmed") {
    return items.filter((item) => item.confirmed && !item.hidden);
  }
  if (filter === "unconfirmed") {
    return items.filter((item) => !item.confirmed);
  }
  if (filter === "hidden") {
    return items.filter((item) => item.hidden);
  }
  return items;
}

export function getArchiveSummary(save) {
  const all = buildArchiveView(save);
  const confirmed = all.filter((item) => item.confirmed).length;
  const hidden = all.filter((item) => item.hidden).length;

  return {
    confirmed,
    total: ACHIEVEMENT_CATALOG.length,
    hidden,
    label: `${confirmed} / ${ACHIEVEMENT_CATALOG.length}`,
  };
}

export function renderNightArchive(root, {
  save,
  filter = "all",
  selectedId = null,
  onFilterChange,
  onSelect,
  onPresentationChange,
  onOpenReview,
  onReturnDay,
} = {}) {
  const activeFilter = FILTERS.some(([id]) => id === filter) ? filter : "all";
  const items = buildArchiveView(save, activeFilter);
  const summary = getArchiveSummary(save);
  const selected = getSelectedItem(save, selectedId);
  const panel = document.createElement("section");

  panel.className = "night-archive";
  panel.setAttribute("aria-label", "夜间档案馆");
  panel.innerHTML = renderArchiveShell({
    activeFilter,
    items,
    selected,
    summary,
  });
  root.replaceChildren(panel);

  panel.querySelector("[data-action='return-day']")?.addEventListener("click", () => {
    onReturnDay?.();
  });
  panel.querySelector("[data-action='open-review']")?.addEventListener("click", () => {
    onOpenReview?.();
  });

  const infoButton = panel.querySelector("[data-action='toggle-rate-info']");
  const infoNote = panel.querySelector("[data-rate-note]");
  infoButton?.addEventListener("click", () => {
    const expanded = infoButton.getAttribute("aria-expanded") === "true";
    infoButton.setAttribute("aria-expanded", String(!expanded));
    infoNote.hidden = expanded;
  });

  for (const button of panel.querySelectorAll("[data-filter]")) {
    button.addEventListener("click", () => onFilterChange?.(button.dataset.filter));
  }
  for (const button of panel.querySelectorAll("button[data-achievement-id]")) {
    button.addEventListener("click", () => onSelect?.(button.dataset.achievementId));
  }
  for (const input of panel.querySelectorAll("[data-presentation-field]")) {
    input.addEventListener("change", () => onPresentationChange?.(
      input.dataset.achievementId,
      { [input.dataset.presentationField]: input.checked },
    ));
  }
}

function collectKnownInstances(value) {
  const instances = Array.isArray(value) ? value : [];
  const byId = new Map();

  for (const instance of instances) {
    const id = getAchievementInstanceId(instance);
    if (!getAchievementDefinition(id)) {
      continue;
    }

    const current = byId.get(id);
    if (!current) {
      byId.set(id, {
        instance,
        hidden: instance?.hidden === true,
        displayable: instance?.displayable !== false,
        spotlightAllowed: instance?.spotlightAllowed !== false,
      });
      continue;
    }

    current.hidden ||= instance?.hidden === true;
    current.displayable &&= instance?.displayable !== false;
    current.spotlightAllowed &&= instance?.spotlightAllowed !== false;
    current.instance = {
      ...current.instance,
      hidden: current.hidden,
      displayable: current.displayable,
      spotlightAllowed: current.spotlightAllowed,
    };
  }

  return byId;
}

function getSelectedItem(save, selectedId) {
  if (!getAchievementDefinition(selectedId)) {
    return null;
  }

  return buildArchiveView(save).find((item) => item.id === selectedId) || null;
}

function renderArchiveShell({ activeFilter, items, selected, summary }) {
  return `
    <header class="archive-topbar">
      <div class="archive-brand">
        <span class="archive-brand-mark" aria-hidden="true"></span>
        <strong>地球 Online</strong>
        <span>夜间档案馆</span>
      </div>
      <div class="archive-topbar-meta">
        <span>已收录 ${escapeHtml(summary.label)}</span>
        <button class="archive-icon-button" type="button" data-action="return-day" aria-label="返回清晨系统" title="返回清晨系统">
          <span aria-hidden="true">☀</span>
        </button>
      </div>
    </header>

    <div class="archive-heading">
      <div>
        <span class="archive-kicker">NIGHT ARCHIVE / EARTH-01</span>
        <h2>人生记录</h2>
      </div>
      <div class="archive-heading-actions">
        <button class="archive-text-button" type="button" data-action="open-review">补录旧存档</button>
        <button class="archive-icon-button" type="button" data-action="toggle-rate-info" aria-label="全球玩家记录率说明" title="记录率说明" aria-expanded="false">i</button>
      </div>
      <p class="archive-rate-note" data-rate-note hidden>全球玩家记录率是基于地球人口与人生经历模型生成的固定估算值，不会随刷新随机变化。</p>
    </div>

    <nav class="archive-filters" aria-label="成就过滤">
      ${FILTERS.map(([id, label]) => `
        <button type="button" data-filter="${id}" aria-pressed="${String(activeFilter === id)}">${label}</button>
      `).join("")}
    </nav>

    <div class="archive-workspace">
      <section class="achievement-list" aria-label="成就记录列表">
        ${items.length > 0 ? items.map(renderAchievementCard).join("") : renderEmptyState(activeFilter)}
      </section>
      ${renderAchievementDetail(selected)}
    </div>
  `;
}

function renderAchievementCard(item) {
  const state = item.hidden ? "隐藏记录" : item.confirmed ? "已收录" : "等待确认";

  return `
    <button
      class="achievement-card ${item.confirmed ? "is-confirmed" : "is-sealed"} ${item.hidden ? "is-hidden-record" : ""}"
      type="button"
      data-achievement-id="${escapeHtml(item.id)}"
      data-rarity="${escapeHtml(item.rarityTier.id)}"
      aria-label="${escapeHtml(item.title)}，${state}"
    >
      <span class="achievement-icon-frame" aria-hidden="true">
        <img src="${escapeHtml(item.iconAsset)}" alt="" width="72" height="72" loading="lazy" decoding="async" />
      </span>
      <span class="achievement-copy">
        <span>${escapeHtml(CATEGORY_LABELS[item.category] || "人生记录")}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.description)}</small>
      </span>
      <span class="achievement-rate">
        <strong>${escapeHtml(formatPercent(item.rarityPercent))}</strong>
        <small>全球玩家记录率</small>
      </span>
      <span class="achievement-state">${state}</span>
    </button>
  `;
}

function renderAchievementDetail(item) {
  if (!item) {
    return `
      <aside class="achievement-detail is-empty" aria-label="成就详情">
        <span class="archive-kicker">ARCHIVE DETAIL</span>
        <p>选择一条记录，读取它在旧存档中的位置。</p>
      </aside>
    `;
  }

  return `
    <aside class="achievement-detail" aria-label="${escapeHtml(item.title)}详情" data-rarity="${escapeHtml(item.rarityTier.id)}">
      <div class="detail-icon" aria-hidden="true">
        <img src="${escapeHtml(item.iconAsset)}" alt="" width="160" height="160" decoding="async" />
      </div>
      <span class="archive-kicker">${escapeHtml(item.rarityTier.label)}</span>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="detail-rate">
        <strong>${escapeHtml(formatPercent(item.rarityPercent))}</strong>
        <span>全球玩家留下过这段记录</span>
      </div>
      ${item.confirmed ? renderPresentationControls(item) : `
        <div class="sealed-record-note">
          <strong>尚未收录</strong>
          <span>可前往旧存档补录，是否达成由你自己确认。</span>
        </div>
      `}
    </aside>
  `;
}

function renderPresentationControls(item) {
  const instance = item.instance || {};

  return `
    <fieldset class="presentation-controls">
      <legend>展示权限</legend>
      ${renderCheckbox(item.id, "hidden", "隐藏这条记录", instance.hidden === true)}
      ${renderCheckbox(item.id, "displayable", "允许出现在个人展示区", instance.displayable !== false)}
      ${renderCheckbox(item.id, "spotlightAllowed", "允许参与代表成就仪式", instance.spotlightAllowed !== false)}
    </fieldset>
  `;
}

function renderCheckbox(id, field, label, checked) {
  return `
    <label>
      <input
        type="checkbox"
        data-achievement-id="${escapeHtml(id)}"
        data-presentation-field="${escapeHtml(field)}"
        ${checked ? "checked" : ""}
      />
      <span>${escapeHtml(label)}</span>
    </label>
  `;
}

function renderEmptyState(filter) {
  return `<div class="archive-empty">${filter === "hidden" ? "没有被隐藏的记录" : "当前分类没有记录"}</div>`;
}

function formatPercent(value) {
  const number = Number(value);
  return `${Number.isFinite(number) ? number.toFixed(1) : "0.0"}%`;
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
