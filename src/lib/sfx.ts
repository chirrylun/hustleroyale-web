"use client";

/*
 * Sound effects made on the spot with the browser's audio engine, so the game has punchy
 * feedback without shipping any audio files. Browsers only allow sound after a tap or click,
 * so `unlockAudio()` is called from the Start button.
 */

export type Sfx = "swing" | "hit" | "crit" | "heal" | "shield" | "stun" | "warn" | "boom" | "ko" | "horn" | "win" | "lose";

let ctx: AudioContext | null = null;
let muted = false;
const lastPlayed = new Map<Sfx, number>();
/** The same sound firing many times in a few milliseconds just turns into noise. */
const MIN_GAP_MS: Partial<Record<Sfx, number>> = { swing: 70, hit: 60, crit: 80, heal: 120, shield: 150, stun: 100, warn: 250 };

try {
  muted = typeof localStorage !== "undefined" && localStorage.getItem("hr-muted") === "1";
} catch {
  /* private window: sound simply starts on */
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    ctx ??= new (window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

export const isMuted = () => muted;
export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem("hr-muted", value ? "1" : "0");
  } catch {
    /* ignore */
  }
}

interface Tone {
  freq: number;
  to?: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  at?: number;
}

function tone(c: AudioContext, { freq, to, dur, type = "square", vol = 0.12, at = 0 }: Tone) {
  const t0 = c.currentTime + at;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gain).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(c: AudioContext, dur: number, vol: number, at = 0) {
  const t0 = c.currentTime + at;
  const buffer = c.createBuffer(1, Math.max(1, Math.floor(c.sampleRate * dur)), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  const gain = c.createGain();
  src.buffer = buffer;
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(gain).connect(c.destination);
  src.start(t0);
}

const RECIPES: Record<Sfx, (c: AudioContext) => void> = {
  swing: (c) => tone(c, { freq: 420, to: 160, dur: 0.09, type: "triangle", vol: 0.06 }),
  hit: (c) => {
    noise(c, 0.06, 0.1);
    tone(c, { freq: 180, to: 70, dur: 0.1, vol: 0.12 });
  },
  crit: (c) => {
    noise(c, 0.12, 0.16);
    tone(c, { freq: 260, to: 50, dur: 0.18, vol: 0.18 });
    tone(c, { freq: 880, to: 440, dur: 0.08, vol: 0.06, at: 0.02 });
  },
  heal: (c) => {
    tone(c, { freq: 523, dur: 0.09, type: "sine", vol: 0.1 });
    tone(c, { freq: 784, dur: 0.14, type: "sine", vol: 0.1, at: 0.08 });
  },
  shield: (c) => tone(c, { freq: 300, to: 600, dur: 0.16, type: "triangle", vol: 0.09 }),
  stun: (c) => {
    tone(c, { freq: 900, to: 300, dur: 0.12, vol: 0.08 });
    tone(c, { freq: 900, to: 300, dur: 0.12, vol: 0.08, at: 0.12 });
  },
  warn: (c) => tone(c, { freq: 220, to: 180, dur: 0.22, type: "sawtooth", vol: 0.07 }),
  boom: (c) => {
    noise(c, 0.35, 0.22);
    tone(c, { freq: 120, to: 30, dur: 0.35, type: "sawtooth", vol: 0.2 });
  },
  ko: (c) => {
    noise(c, 0.18, 0.14);
    tone(c, { freq: 400, to: 60, dur: 0.4, type: "sawtooth", vol: 0.14 });
  },
  horn: (c) => {
    tone(c, { freq: 196, dur: 0.5, type: "sawtooth", vol: 0.12 });
    tone(c, { freq: 147, dur: 0.6, type: "sawtooth", vol: 0.12, at: 0.45 });
  },
  win: (c) => [523, 659, 784, 1046].forEach((f, i) => tone(c, { freq: f, dur: 0.18, vol: 0.1, at: i * 0.12 })),
  lose: (c) => [392, 330, 262, 196].forEach((f, i) => tone(c, { freq: f, dur: 0.22, type: "triangle", vol: 0.1, at: i * 0.16 })),
};

export function playSfx(name: Sfx) {
  if (muted || !ctx || ctx.state !== "running") return;
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? 0) < (MIN_GAP_MS[name] ?? 0)) return;
  lastPlayed.set(name, now);
  try {
    RECIPES[name](ctx);
  } catch {
    /* sound is never worth breaking a match over */
  }
}
