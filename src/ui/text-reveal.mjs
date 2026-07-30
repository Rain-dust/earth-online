const DEFAULT_PUNCTUATION_DELAY = Object.freeze({
  "，": 120,
  "。": 220,
  "：": 160,
  "；": 180,
  "\n": 280,
});

export function revealText(element, text, {
  characterDelay = 40,
  punctuationDelay = DEFAULT_PUNCTUATION_DELAY,
  signal,
  reducedMotion = false,
  schedule = globalThis.setTimeout,
  cancel = globalThis.clearTimeout,
  onComplete = () => {},
} = {}) {
  const fullText = String(text ?? "");
  let index = 0;
  let timer = null;
  let status = "running";
  let settlePromise;
  const promise = new Promise((resolve) => { settlePromise = resolve; });

  element.setAttribute?.("aria-label", fullText);
  element.setAttribute?.("tabindex", "0");
  element.textContent = "";

  const removeListeners = () => {
    element.removeEventListener?.("click", handleClick);
    element.removeEventListener?.("keydown", handleKeydown);
    signal?.removeEventListener?.("abort", handleAbort);
  };

  const finish = (nextStatus, writeFullText) => {
    if (status !== "running") return;
    status = nextStatus;
    if (timer !== null) cancel(timer);
    timer = null;
    removeListeners();
    if (writeFullText) element.textContent = fullText;
    if (nextStatus === "complete") onComplete();
    settlePromise(nextStatus);
  };

  const complete = () => finish("complete", true);
  const abort = () => finish("cancelled", false);

  function handleClick() {
    complete();
  }

  function handleKeydown(event) {
    if (["Enter", " ", "Space", "Spacebar"].includes(event.key)) {
      event.preventDefault?.();
      complete();
    }
  }

  function handleAbort() {
    abort();
  }

  const tick = () => {
    if (status !== "running" || signal?.aborted) {
      abort();
      return;
    }
    element.textContent += fullText[index] || "";
    const revealed = fullText[index] || "";
    index += 1;
    if (index >= fullText.length) {
      complete();
      return;
    }
    timer = schedule(tick, characterDelay + Number(punctuationDelay[revealed] || 0));
  };

  element.addEventListener?.("click", handleClick);
  element.addEventListener?.("keydown", handleKeydown);
  signal?.addEventListener?.("abort", handleAbort, { once: true });

  if (reducedMotion || fullText.length === 0) {
    complete();
  } else if (signal?.aborted) {
    abort();
  } else {
    timer = schedule(tick, characterDelay);
  }

  return {
    get finished() { return status !== "running"; },
    complete,
    cancel: abort,
    promise,
  };
}
