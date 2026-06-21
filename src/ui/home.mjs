import { estimatePopulation, formatPopulation } from "../core/population.mjs";

export function renderHome(root) {
  root.className = "home-overlay";
  root.innerHTML = `
    <div class="title-lockup">
      <h1>地球 Online</h1>
      <p>请勿在NPC身上浪费过多时间</p>
    </div>
    <aside class="player-count" aria-live="polite">
      <span>GLOBAL PLAYERS ONLINE</span>
      <strong data-player-count></strong>
      <small>全球在线玩家估算</small>
    </aside>
  `;

  const valueNode = root.querySelector("[data-player-count]");

  function update() {
    valueNode.textContent = formatPopulation(estimatePopulation());
  }

  update();
  const timer = window.setInterval(update, 1000);
  return () => window.clearInterval(timer);
}
