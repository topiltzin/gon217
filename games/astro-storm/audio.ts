import type { AstroEvent } from "./logic";

/** Astro Storm's sounds, synthesised with Web Audio (no files). Starts on the first click. */
export class AstroAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private muted = false;

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.45, this.ctx.currentTime, 0.02);
  }

  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, len);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  private tone(type: OscillatorType, from: number, to: number, time: number, volume: number, delay = 0) {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(to, t + time);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + time);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + time + 0.02);
  }

  private burst(time: number, volume: number, freq: number) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(freq, t);
    filter.frequency.exponentialRampToValueAtTime(60, t + time);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + time);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + time + 0.02);
  }

  play(e: AstroEvent) {
    if (!this.ctx || !this.master) return;
    switch (e.type) {
      case "shot":
        this.tone("square", 1400, 300, 0.09, 0.05);
        break;
      case "hit":
        this.tone("triangle", 600, 200, 0.06, 0.08);
        break;
      case "boom":
        this.burst(0.25 + e.size * 0.15, 0.35 + e.size * 0.1, 1800);
        break;
      case "crash":
        this.burst(0.6, 0.7, 2500);
        this.tone("sawtooth", 200, 50, 0.5, 0.15);
        break;
      case "roll":
        this.burst(0.35, 0.25, 4000);
        break;
      case "ring":
        [880, 1175, 1568].forEach((f, i) => this.tone("sine", f, f, 0.15, 0.12, i * 0.07));
        break;
      case "wave":
        [523, 659, 784].forEach((f, i) => this.tone("square", f, f, 0.14, 0.07, i * 0.1));
        break;
      case "enemyShot":
        this.tone("sawtooth", 300, 700, 0.15, 0.04);
        break;
      case "over":
        this.burst(1.2, 0.8, 1500);
        break;
    }
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
