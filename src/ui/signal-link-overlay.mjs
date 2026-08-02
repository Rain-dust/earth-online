const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function buildSignalLinkPath(source, target) {
  const control = {
    x: source.x + (target.x - source.x) * 0.45,
    y: source.y + (target.y - source.y) * 0.2,
  };
  return `M ${round(source.x)} ${round(source.y)} Q ${round(control.x)} ${round(control.y)} ${round(target.x)} ${round(target.y)}`;
}

export function renderSignalLinkOverlay(root, {
  source,
  subscribe,
  variant = "writeback",
} = {}) {
  const document = root.ownerDocument ?? globalThis.document;
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  const path = document.createElementNS(SVG_NAMESPACE, "path");
  svg.classList.add("signal-link-overlay", `signal-link-${variant}`);
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("vector-effect", "non-scaling-stroke");
  svg.append(path);
  root.append(svg);

  let active = true;
  const unsubscribe = subscribe?.((projection) => {
    if (!active) return;
    svg.hidden = !projection?.visible;
    if (!projection?.visible) return;
    const rootRect = root.getBoundingClientRect();
    const sourceRect = source?.getBoundingClientRect?.();
    if (!sourceRect) {
      svg.hidden = true;
      return;
    }
    const start = {
      x: sourceRect.right - rootRect.left,
      y: sourceRect.top + sourceRect.height / 2 - rootRect.top,
    };
    path.setAttribute("d", buildSignalLinkPath(start, projection));
  }) ?? (() => {});

  return () => {
    if (!active) return;
    active = false;
    unsubscribe();
    root.removeChild?.(svg);
  };
}

function round(value) {
  return Math.round(Number(value) * 10) / 10;
}
