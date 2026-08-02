import test from "node:test";
import assert from "node:assert/strict";
import { buildSignalLinkPath, renderSignalLinkOverlay } from "../../src/ui/signal-link-overlay.mjs";

test("signal link path bends once between copy and globe anchor", () => {
  assert.equal(buildSignalLinkPath({ x: 20, y: 30 }, { x: 180, y: 90 }), "M 20 30 Q 92 42 180 90");
});

test("signal link subscribes once and cleans up its projection listener", () => {
  const removed = [];
  const root = createRoot(removed);
  let emit;
  let unsubscribed = 0;
  const cleanup = renderSignalLinkOverlay(root, {
    source: { getBoundingClientRect: () => ({ right: 40, top: 20, height: 20 }) },
    subscribe(callback) {
      emit = callback;
      return () => { unsubscribed += 1; };
    },
  });

  emit({ x: 200, y: 100, visible: true });
  assert.equal(root.path.getAttribute("d"), "M 40 30 Q 112 44 200 100");
  assert.equal(root.svg.hidden, false);
  emit({ x: 0, y: 0, visible: false });
  assert.equal(root.svg.hidden, true);

  cleanup();
  cleanup();
  assert.equal(unsubscribed, 1);
  assert.deepEqual(removed, [root.svg]);
});

function createRoot(removed) {
  const path = attributeNode();
  const svg = {
    hidden: false,
    classList: { add() {} },
    setAttribute() {},
    append(node) { this.path = node; },
  };
  return {
    svg,
    path,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    ownerDocument: {
      createElementNS(_namespace, tag) {
        return tag === "svg" ? svg : path;
      },
    },
    append(node) { this.svg = node; this.path = node.path; },
    removeChild(node) { removed.push(node); },
  };
}

function attributeNode() {
  const attributes = new Map();
  return {
    setAttribute(name, value) { attributes.set(name, value); },
    getAttribute(name) { return attributes.get(name); },
  };
}
