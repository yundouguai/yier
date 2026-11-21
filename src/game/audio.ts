let actx: AudioContext | null = null;
let muted = false;
let noiseBuf: AudioBuffer | null = null;

export function isAudioMuted(): boolean {
  return muted;
}

export function setAudioMuted(next: boolean): void {
  muted = next;
  if (!muted) {
    ensureAudio();
  }
}

export function toggleAudioMuted(): boolean {
  setAudioMuted(!muted);
  return muted;
}

export function ensureAudio(): void {
  if (muted) return;
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

function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.25);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  noiseBuf = buf;
  return buf;
}

function playFilteredNoise(
  dur = 0.06,
  freq = 1200,
  q = 2.0,
  vol = 0.08,
  filterType: BiquadFilterType = 'bandpass',
  delay = 0,
): void {
  if (muted || !actx) return;
  try {
    const start = actx.currentTime + delay;
    const src = actx.createBufferSource();
    src.buffer = getNoiseBuffer(actx);
    const flt = actx.createBiquadFilter();
    flt.type = filterType;
    flt.frequency.setValueAtTime(freq, start);
    flt.Q.setValueAtTime(q, start);
    const g = actx.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    src.connect(flt).connect(g).connect(actx.destination);
    src.start(start);
    src.stop(start + dur);
  } catch {
    // Ignore audio scheduling failure
  }
}

export function beep(
  freq: number,
  dur = 0.08,
  type: OscillatorType = 'sine',
  vol = 0.15,
  freqEnd?: number,
  delay = 0,
): void {
  if (muted || !actx) return;
  try {
    const start = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (freqEnd !== undefined) {
      o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), start + dur);
    }
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.connect(g).connect(actx.destination);
    o.start(start);
    o.stop(start + dur);
  } catch {
    // Ignore audio scheduling failure
  }
}

export function sndRoll(): void {
  // 木质骰盅清脆连击 + 轻柔落定音
  playFilteredNoise(0.045, 1650, 3.2, 0.09, 'bandpass', 0);
  playFilteredNoise(0.045, 1950, 3.4, 0.08, 'bandpass', 0.075);
  playFilteredNoise(0.055, 1400, 2.8, 0.09, 'bandpass', 0.15);
  beep(260, 0.09, 'triangle', 0.1, 360, 0.02);
  beep(380, 0.11, 'triangle', 0.11, 460, 0.16);
}

export function sndHop(): void {
  // Q弹小熊跳跃音
  beep(460, 0.065, 'sine', 0.085, 640);
}

export function sndCap(): void {
  // 踩扁冲击低频闷响 + 飞出哨音
  playFilteredNoise(0.11, 420, 1.2, 0.14, 'lowpass', 0);
  beep(220, 0.14, 'triangle', 0.16, 75, 0);
  beep(520, 0.18, 'sine', 0.08, 920, 0.08);
}

export function sndWin(): void {
  // 温暖五声音阶/大三和弦胜利扇形号角
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
    beep(f, 0.24, 'triangle', 0.15, undefined, i * 0.125);
    beep(f * 0.5, 0.24, 'sine', 0.07, undefined, i * 0.125);
  });
}

export function sndYourTurn(): void {
  beep(523.25, 0.09, 'sine', 0.1, undefined, 0);
  beep(659.25, 0.14, 'triangle', 0.11, undefined, 0.085);
}

/** 轻柔天气环境音效脉冲（仅在音频已激活且未静音时触发，绝不打扰主音效） */
export function playWeatherAmbientPulse(tod: 'morning' | 'noon' | 'afternoon' | 'evening'): void {
  if (muted || !actx || actx.state !== 'running') return;
  if (tod === 'morning') {
    // 清晨清脆小鸟短鸣
    const base = 1850 + Math.random() * 450;
    beep(base, 0.075, 'sine', 0.022, base * 1.24, 0);
    beep(base * 1.18, 0.09, 'sine', 0.02, base * 0.94, 0.11);
    if (Math.random() < 0.55) {
      beep(base * 1.32, 0.07, 'sine', 0.018, base * 1.48, 0.24);
    }
  } else if (tod === 'noon') {
    // 正午轻风拂过树梢
    playFilteredNoise(0.24, 2400, 1.4, 0.016, 'bandpass', 0);
  } else if (tod === 'afternoon') {
    // 下午微风吹动落叶沙沙声
    playFilteredNoise(0.22, 920, 1.1, 0.02, 'bandpass', 0);
    playFilteredNoise(0.18, 1280, 1.5, 0.014, 'bandpass', 0.14);
  } else {
    // 夜晚虫鸣三连音
    const f = 3750 + Math.random() * 350;
    beep(f, 0.038, 'sine', 0.017, f * 0.97, 0);
    beep(f, 0.038, 'sine', 0.017, f * 0.97, 0.07);
    beep(f, 0.045, 'sine', 0.015, f * 0.95, 0.14);
  }
}
