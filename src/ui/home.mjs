import {
  WORLD_POPULATION_BASELINE,
  estimatePopulation,
} from "../core/population.mjs";

export function getHomeMarkup({
  population = estimatePopulation(),
  baseline = WORLD_POPULATION_BASELINE,
} = {}) {
  const populationYi = Math.round(population / 100_000_000);
  const asOf = new Date(baseline.timestampMs).toISOString().slice(0, 10);

  return `
    <div class="title-lockup" data-home-title>
      <h1 aria-label="地球 Online">
        <span class="title-earth">地球</span>
        <span class="title-online">Online</span>
      </h1>
      <p class="population-worldview" data-population-worldview data-population-estimate="${population}">
        约 ${populationYi} 亿名玩家正在共同运行这颗星球
      </p>
      <p class="population-disclosure" data-population-source data-population-as-of="${asOf}"
        title="${escapeHtml(baseline.source)}">
        世界人口动态估算 · ${asOf} 世界银行全球人口基准
      </p>
      <button class="home-radio-command" type="button" data-home-action="enter" data-home-radio-command>
        <i data-lucide="radio" aria-hidden="true"></i>
        <span>发送我的信号</span>
      </button>
      <p class="home-npc-note" data-home-npc-note><span>SYS NOTICE</span>请勿在 NPC 身上浪费过多时间</p>
    </div>
  `;
}

export function renderHome(root, options) {
  root.className = "home-overlay";
  root.innerHTML = getHomeMarkup(options);
  globalThis.lucide?.createIcons({ root });
  return () => {};
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
