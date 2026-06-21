export function renderHome(root) {
  root.replaceChildren();

  const title = document.createElement("div");
  title.className = "title-lockup";
  const heading = document.createElement("h1");
  heading.textContent = "地球 Online";
  const readout = document.createElement("p");
  readout.textContent = "旧存档待接入";

  title.append(heading, readout);
  root.append(title);
}
