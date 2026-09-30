/**
 * Retro sound effects synthesised with the Web Audio API: no audio files.
 * The AudioContext is created on the first user click (browsers block audio
 * before that), and a master gain handles mute.
 */

export type Sound =
  | "pistol"
  | "shotgun"
  | "enemyAttack"
  | "spit"
  | "enemyHit"
  | "enemyDeath"
  | "playerHurt"
  | "pickup"
  | "weaponPickup"
  | "click"
  | "door"
  | "reload"
  | "empty"
  | "secret";

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted = false;

  /** Call from a click/key handler. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(this.ctx.destination);
      this.noise = this.makeNoise(1.5);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.02);
  }

  /** Low industrial drone with slowly swelling wind. */
  startAmbient() {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.ambient) return;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(1, ctx.currentTime, 1.5);
    out.connect(this.master);
    this.ambient = out;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = "lowpass";
    lowpass.frequency.value = 180;
    lowpass.connect(out);
    for (const freq of [41, 41.6, 61.8]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.05;
      osc.connect(g).connect(lowpass);
      osc.start();
    }

    const wind = ctx.createBufferSource();
    wind.buffer = this.noise;
    wind.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 400;
    band.Q.value = 0.8;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.025;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain).connect(windGain.gain);
    wind.connect(band).connect(windGain).connect(out);
    wind.start();
    lfo.start();
  }

  /** Quieter while paused or on an end screen. */
  setAmbientLevel(level: number) {
    if (this.ambient && this.ctx) this.ambient.gain.setTargetAtTime(level, this.ctx.currentTime, 0.3);
  }

  play(sound: Sound) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime;
    switch (sound) {
      case "pistol":
        this.burst(t, 0.14, "bandpass", 1800, 0.9);
        this.tone(t, "sine", 160, 45, 0.12, 0.7);
        break;
      case "shotgun":
        this.burst(t, 0.38, "lowpass", 1400, 1.2);
        this.tone(t, "sine", 110, 30, 0.25, 1);
        this.burst(t + 0.45, 0.05, "highpass", 2500, 0.3);
        this.burst(t + 0.58, 0.06, "highpass", 2000, 0.3);
        break;
      case "enemyAttack":
        this.tone(t, "sawtooth", 140, 60, 0.35, 0.35, 700);
        break;
      case "spit":
        this.tone(t, "square", 300, 900, 0.18, 0.2, 2000);
        this.burst(t, 0.2, "bandpass", 900, 0.3);
        break;
      case "enemyHit":
        this.tone(t, "square", 240, 110, 0.09, 0.25, 1500);
        break;
      case "enemyDeath":
        this.tone(t, "sawtooth", 320, 35, 0.7, 0.4, 900);
        this.burst(t, 0.5, "lowpass", 600, 0.5);
        break;
      case "playerHurt":
        this.tone(t, "square", 190, 80, 0.22, 0.35, 800);
        break;
      case "pickup":
        this.tone(t, "square", 660, 660, 0.06, 0.2);
        this.tone(t + 0.07, "square", 990, 990, 0.08, 0.2);
        break;
      case "weaponPickup":
        [330, 440, 660].forEach((f, i) => this.tone(t + i * 0.09, "square", f, f, 0.1, 0.22));
        break;
      case "click":
        this.tone(t, "square", 880, 880, 0.04, 0.15);
        break;
      case "door":
        this.burst(t, 0.6, "lowpass", 300, 0.5);
        this.tone(t, "sawtooth", 55, 50, 0.6, 0.15, 200);
        break;
      case "reload":
        this.burst(t, 0.04, "highpass", 3000, 0.3);
        this.burst(t + 0.25, 0.05, "highpass", 2200, 0.3);
        break;
      case "empty":
        this.burst(t, 0.03, "highpass", 4000, 0.25);
        break;
      case "secret":
        [392, 523, 659, 784].forEach((f, i) => this.tone(t + i * 0.12, "triangle", f, f, 0.14, 0.25));
        break;
    }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private envelope(t: number, duration: number, volume: number): GainNode {
    const g = this.ctx!.createGain();
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + duration);
    g.connect(this.master!);
    return g;
  }

  private burst(t: number, duration: number, type: BiquadFilterType, freq: number, volume: number) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    src.connect(filter).connect(this.envelope(t, duration, volume));
    src.start(t, Math.random() * 0.5, duration + 0.05);
  }

  private tone(t: number, type: OscillatorType, from: number, to: number, duration: number, volume: number, lowpass?: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + duration);
    const env = this.envelope(t, duration, volume);
    if (lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = lowpass;
      osc.connect(f).connect(env);
    } else osc.connect(env);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.master = null;
    this.ambient = null;
  }
}

/** A one-off click for menu buttons outside the game. */
let menuAudio: GameAudio | null = null;
export function menuClick() {
  menuAudio ??= new GameAudio();
  menuAudio.unlock();
  menuAudio.play("click");
}
