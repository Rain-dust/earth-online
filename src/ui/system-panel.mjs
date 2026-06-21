export function renderSystemPanel(root, { save, onChange, onExit }) {
  root.replaceChildren();

  const panel = document.createElement("section");
  panel.className = "system-panel";
  const nickname = save.profile?.nickname || "未命名玩家";
  const heading = document.createElement("h2");
  heading.textContent = "系统面板";
  const readout = document.createElement("p");
  readout.textContent = `玩家：${nickname}`;
  const refreshButton = document.createElement("button");
  refreshButton.type = "button";
  refreshButton.textContent = "保存占位状态";
  const exitButton = document.createElement("button");
  exitButton.type = "button";
  exitButton.textContent = "退出";

  refreshButton.addEventListener("click", () => {
    onChange({ ...save, exportedAt: new Date().toISOString() });
  });
  exitButton.addEventListener("click", onExit);

  panel.append(heading, readout, refreshButton, exitButton);
  root.append(panel);
}
