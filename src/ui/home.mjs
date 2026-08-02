import {
  estimatePopulation,
  formatPopulation,
} from "../core/population.mjs";

export function getHomeMarkup({
  population = estimatePopulation(),
} = {}) {
  return `
    <div class="title-lockup" data-home-title>
      <h1 aria-label="地球 Online">
        <span class="title-earth">地球</span>
        <span class="title-online">Online</span>
      </h1>
      <p class="population-worldview" data-population-worldview data-population-estimate="${population}">
        <span>GLOBAL PLAYERS ONLINE</span>
        <strong data-population-value>${formatPopulation(population)}</strong>
        <small>全球在线玩家估算</small>
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
  const value = root.querySelector?.("[data-population-value]");
  const worldview = root.querySelector?.("[data-population-worldview]");
  const timer = globalThis.setInterval?.(() => {
    const population = estimatePopulation();
    if (value) value.textContent = formatPopulation(population);
    if (worldview?.dataset) worldview.dataset.populationEstimate = String(population);
  }, 1000);
  timer?.unref?.();

  return () => globalThis.clearInterval?.(timer);
}
