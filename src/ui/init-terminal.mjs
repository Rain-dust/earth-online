import { createEmptySave } from "../core/storage.mjs";

export function renderInitTerminal(root, { onComplete, onExit }) {
  root.replaceChildren();

  const shell = document.createElement("section");
  shell.className = "system-panel";
  const heading = document.createElement("h2");
  heading.textContent = "初始化终端";
  const note = document.createElement("p");
  note.textContent = "占位流程，后续任务会替换为完整校准。";
  const completeButton = document.createElement("button");
  completeButton.type = "button";
  completeButton.textContent = "创建临时档案";
  const exitButton = document.createElement("button");
  exitButton.type = "button";
  exitButton.textContent = "退出";

  completeButton.addEventListener("click", () => {
    const save = createEmptySave();
    onComplete({
      ...save,
      profile: {
        nickname: "未命名玩家",
        gender: null,
        createdAt: save.exportedAt,
      },
    });
  });
  exitButton.addEventListener("click", onExit);

  shell.append(heading, note, completeButton, exitButton);
  root.append(shell);
}
