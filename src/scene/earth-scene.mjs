export function createEarthScene(stage) {
  return {
    start() {
      stage.dataset.sceneReady = "true";
    },
    focus() {
      return Promise.resolve();
    },
    home() {},
  };
}
