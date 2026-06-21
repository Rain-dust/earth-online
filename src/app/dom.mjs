export function getDom() {
  return {
    body: document.body,
    stage: mustFind("#globe-stage"),
    homeOverlay: mustFind("#home-overlay"),
    systemRoot: mustFind("#system-root"),
  };
}

export function setSystemVisible(systemRoot, visible) {
  systemRoot.hidden = !visible;
  systemRoot.setAttribute("aria-hidden", String(!visible));
}

function mustFind(selector) {
  const node = document.querySelector(selector);
  if (!node) {
    throw new Error(`Missing required DOM node: ${selector}`);
  }
  return node;
}
