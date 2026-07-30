export const HANDSHAKE_TIMINGS = Object.freeze({
  entry: Object.freeze({
    focusDuration: 900,
    downlinkAt: 1050,
    awakeAt: 1700,
    returnAt: 2150,
    completeAt: 3000,
  }),
  restore: Object.freeze({
    focusDuration: 650,
    downlinkAt: 800,
    awakeAt: 1250,
    returnAt: 1650,
    completeAt: 2300,
  }),
});

export function createSatelliteHandshake(handlers = {}) {
  let activeSequence = null;
  let nextSequenceId = 0;

  function establishPlayerSignal(
    location,
    { reducedMotion = false, mode = "entry", signal } = {},
  ) {
    if (!location) {
      return Promise.reject(new TypeError("location is required"));
    }

    activeSequence?.abort("superseded");
    const timing = HANDSHAKE_TIMINGS[mode] ?? HANDSHAKE_TIMINGS.entry;
    const sequenceId = ++nextSequenceId;
    const timers = new Set();
    let settled = false;
    let resolveSequence;

    const promise = new Promise((resolve) => {
      resolveSequence = resolve;
    });

    const finish = (status) => {
      if (settled) {
        return;
      }
      settled = true;
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      signal?.removeEventListener("abort", abortFromSignal);
      if (activeSequence?.id === sequenceId) {
        activeSequence = null;
      }
      if (status !== "completed") {
        handlers.onCancel?.({ location, mode, status });
      }
      resolveSequence({ status, mode });
    };

    const abortFromSignal = () => finish("aborted");
    const schedule = (delay, callback) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        if (!settled) {
          callback();
        }
      }, delay);
      timers.add(timer);
    };

    activeSequence = {
      id: sequenceId,
      abort: (reason = "aborted") => finish(reason),
    };

    if (signal?.aborted) {
      finish("aborted");
      return promise;
    }
    signal?.addEventListener("abort", abortFromSignal, { once: true });

    handlers.onAcquireSatellite?.({ location, mode, animated: !reducedMotion });
    handlers.onAnchorState?.("acquiring", location);
    Promise.resolve(
      handlers.focusLocation?.(location, {
        duration: reducedMotion ? 0 : timing.focusDuration,
        reducedMotion,
      }),
    ).catch(() => finish("aborted"));

    if (reducedMotion) {
      handlers.onDownlink?.({ location, animated: false });
      handlers.onAnchorState?.("awake", location);
      handlers.onReturnPulse?.({ location, animated: false });
      handlers.onComplete?.({ location, mode });
      finish("completed");
      return promise;
    }

    schedule(timing.downlinkAt, () => handlers.onDownlink?.({ location, animated: true }));
    schedule(timing.awakeAt, () => handlers.onAnchorState?.("awake", location));
    schedule(timing.returnAt, () => handlers.onReturnPulse?.({ location, animated: true }));
    schedule(timing.completeAt, () => {
      handlers.onComplete?.({ location, mode });
      finish("completed");
    });
    return promise;
  }

  function abortPlayerSignalHandshake() {
    activeSequence?.abort("aborted");
  }

  return Object.freeze({
    establishPlayerSignal,
    abortPlayerSignalHandshake,
  });
}
