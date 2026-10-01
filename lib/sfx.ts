import { soundOn } from "./settings";

/**
 * Small synthesised sound effects for the 2D games (no audio files). The audio
 * context starts on the first click or key press; every sound respects the
 * site-wide sound setting.
 */

export type Sfx =
  | "coin"
  | "jump"
  | "bump"
  | "smash"
  | "stomp"
  | "hurt"
  | "levelUp"
  | "win"
  | "lose"
  | "plant"
  | "sun"
  | "boom"
  | "shoo"
  | "mower"
  | "flip"
  | "match"
  | "miss"
  | "combo"
  | "place"
  | "catch"
  | "tick";

let ctx: AudioContext | null = null;
let noise: AudioBuffer | null = null;

/** Call from a user gesture. Safe to call often. */
export function unlockSfx() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(type: OscillatorType, from: number, to: number, time: number, volume: number, delay = 0) {
  const c = ctx!;
  const t = c.currentTime + delay;
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + time);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + time);
  osc.connect(gain).connect(c.destination);
  osc.start(t);
  osc.stop(t + time + 0.02);
}

function hiss(time: number, volume: number, freq: number) {
  const c = ctx!;
  const t = c.currentTime;
  const src = c.createBufferSource();
  src.buffer = noise;
  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(freq, t);
  filter.frequency.exponentialRampToValueAtTime(80, t + time);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + time);
  src.connect(filter).connect(gain).connect(c.destination);
  src.start(t, Math.random() * 0.5);
  src.stop(t + time + 0.02);
}

const notes = (freqs: number[], gap: number, type: OscillatorType = "square", volume = 0.08, length = 0.14) =>
  freqs.forEach((f, i) => tone(type, f, f, length, volume, i * gap));

export function playSfx(name: Sfx) {
  if (!ctx || !soundOn()) return;
  if (ctx.state === "suspended") void ctx.resume();
  switch (name) {
    case "coin":
      notes([988, 1319], 0.06, "square", 0.07, 0.1);
      break;
    case "jump":
      tone("square", 300, 700, 0.15, 0.06);
      break;
    case "bump":
      tone("triangle", 180, 120, 0.1, 0.15);
      break;
    case "smash":
      hiss(0.25, 0.3, 2500);
      tone("square", 200, 80, 0.15, 0.06);
      break;
    case "stomp":
      tone("square", 500, 120, 0.12, 0.08);
      break;
    case "hurt":
      tone("sawtooth", 400, 90, 0.35, 0.1);
      break;
    case "levelUp":
      notes([523, 659, 784, 1047, 1319], 0.08);
      break;
    case "win":
      notes([523, 659, 784, 1047], 0.12, "square", 0.08, 0.2);
      break;
    case "lose":
      notes([392, 330, 262], 0.16, "triangle", 0.12, 0.25);
      break;
    case "plant":
      tone("sine", 400, 650, 0.12, 0.12);
      break;
    case "sun":
      notes([880, 1175], 0.05, "sine", 0.1, 0.12);
      break;
    case "boom":
      hiss(0.6, 0.5, 1800);
      tone("sine", 120, 40, 0.5, 0.25);
      break;
    case "shoo":
      tone("triangle", 700, 1200, 0.1, 0.06);
      break;
    case "mower":
      hiss(0.8, 0.2, 600);
      tone("sawtooth", 90, 110, 0.8, 0.05);
      break;
    case "flip":
      tone("triangle", 600, 900, 0.06, 0.08);
      break;
    case "match":
      notes([660, 880], 0.07, "sine", 0.12, 0.14);
      break;
    case "miss":
      tone("triangle", 300, 220, 0.18, 0.08);
      break;
    case "combo":
      notes([784, 988, 1175, 1568], 0.05, "square", 0.06, 0.1);
      break;
    case "place":
      tone("square", 520, 520, 0.07, 0.06);
      break;
    case "catch":
      tone("square", 700, 1400, 0.08, 0.06);
      break;
    case "tick":
      tone("sine", 1000, 1000, 0.04, 0.05);
      break;
  }
}
