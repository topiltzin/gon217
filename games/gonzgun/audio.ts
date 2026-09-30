/**
 * Gonzgun's sounds, synthesised with Web Audio (no files). The context starts
 * on the first click (browsers block audio before that).
 */

export type Sound = "shot" | "hit" | "ko" | "wall" | "pickup" | "dash" | "spawn" | "win" | "count" | "go";

export class GonzAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setMuted(muted: boolean) {
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(muted ? 0 : 0.55, this.ctx.currentTime, 0.02);
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

  private burst(time: number, volume: number, freq: number, q = 1) {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + time);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + time + 0.02);
  }

  play(sound: Sound) {
    if (!this.ctx || !this.master) return;
    switch (sound) {
      case "shot":
        this.burst(0.12, 0.5, 1800, 0.8);
        this.tone("square", 520, 90, 0.1, 0.12);
        break;
      case "hit":
        this.burst(0.15, 0.5, 500, 1.5);
        this.tone("sine", 240, 60, 0.15, 0.3);
        break;
      case "ko":
        this.burst(0.5, 0.6, 300, 0.7);
        this.tone("sawtooth", 300, 40, 0.6, 0.18);
        this.tone("square", 880, 220, 0.35, 0.08, 0.05);
        break;
      case "wall":
        this.burst(0.05, 0.18, 3500, 2);
        break;
      case "pickup":
        this.tone("square", 660, 660, 0.08, 0.1);
        this.tone("square", 990, 990, 0.12, 0.1, 0.08);
        break;
      case "dash":
        this.burst(0.18, 0.25, 900, 0.5);
        break;
      case "spawn":
        this.tone("triangle", 200, 800, 0.25, 0.15);
        break;
      case "count":
        this.tone("square", 440, 440, 0.15, 0.12);
        break;
      case "go":
        this.tone("square", 880, 880, 0.35, 0.14);
        this.tone("square", 1320, 1320, 0.35, 0.06);
        break;
      case "win":
        [523, 659, 784, 1047].forEach((f, i) => this.tone("square", f, f, 0.18, 0.1, i * 0.12));
        break;
    }
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
