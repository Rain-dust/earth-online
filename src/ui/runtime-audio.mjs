const CUES = Object.freeze({
  signal: [
    { frequency: 392, at: 0, duration: 0.09, gain: 0.025 },
    { frequency: 587, at: 0.08, duration: 0.16, gain: 0.018 },
  ],
  downlink: [
    { frequency: 880, at: 0, duration: 0.06, gain: 0.014 },
    { frequency: 1175, at: 0.07, duration: 0.08, gain: 0.011 },
  ],
  confirmed: [
    { frequency: 523, at: 0, duration: 0.12, gain: 0.02 },
    { frequency: 659, at: 0.1, duration: 0.18, gain: 0.017 },
  ],
  achievement: [
    { frequency: 659, at: 0, duration: 0.34, gain: 0.036 },
    { frequency: 988, at: 0.12, duration: 0.46, gain: 0.03 },
  ],
  daily: [
    { frequency: 523, at: 0, duration: 0.22, gain: 0.02 },
    { frequency: 784, at: 0.1, duration: 0.34, gain: 0.017 },
  ],
  taskSync: [
    { frequency: 440, at: 0, duration: 0.08, gain: 0.018 },
    { frequency: 659, at: 0.07, duration: 0.11, gain: 0.02 },
    { frequency: 880, at: 0.16, duration: 0.2, gain: 0.016 },
  ],
  archive: [
    { frequency: 196, at: 0, duration: 0.24, gain: 0.018 },
    { frequency: 294, at: 0.12, duration: 0.3, gain: 0.012 },
  ],
});

export function createRuntimeAudio(windowRef = globalThis.window) {
  let context = null;
  let disposed = false;

  function play(name) {
    if (disposed || !CUES[name]) return;
    const AudioContext = windowRef?.AudioContext || windowRef?.webkitAudioContext;
    if (!AudioContext) return;

    try {
      context ||= new AudioContext();
      if (context.state === "suspended") void context.resume();
      const now = context.currentTime;
      for (const note of CUES[name]) playNote(context, now, note);
    } catch {
      // Audio is an enhancement. The visual flow must never depend on it.
    }
  }

  function destroy() {
    disposed = true;
    const current = context;
    context = null;
    void current?.close?.();
  }

  return Object.freeze({ play, destroy });
}

function playNote(context, now, note) {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = now + note.at;
  const end = start + note.duration;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(note.frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(note.gain, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
}
