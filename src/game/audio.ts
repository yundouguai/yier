let actx: AudioContext | null = null;

export function ensureAudio(): void {
  if (!actx) {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        actx = new AudioCtx();
      }
    } catch {
      // Audio context unavailable
    }
  }
  if (actx && actx.state === 'suspended') {
    actx.resume().catch(() => {});
  }
}

export function beep(
  freq: number,
  dur = 0.08,
  type: OscillatorType = 'sine',
  vol = 0.15,
): void {
  if (!actx) return;
  try {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch {
    // Ignore audio scheduling failure
  }
}

export function sndRoll(): void {
  beep(220, 0.1, 'triangle', 0.12);
  window.setTimeout(() => beep(330, 0.1, 'triangle', 0.12), 110);
}

export function sndHop(): void {
  beep(560, 0.05, 'sine', 0.08);
}

export function sndCap(): void {
  beep(300, 0.12, 'sawtooth', 0.1);
  window.setTimeout(() => beep(180, 0.18, 'sawtooth', 0.1), 100);
}

export function sndWin(): void {
  [523, 659, 784, 1046].forEach((f, i) =>
    window.setTimeout(() => beep(f, 0.22, 'triangle', 0.16), i * 140),
  );
}

export function sndYourTurn(): void {
  beep(523, 0.09, 'sine', 0.11);
  window.setTimeout(() => beep(659, 0.14, 'sine', 0.12), 85);
}
