/**
 * Audio engine. Short UI cues are synthesized with WebAudio (oscillators +
 * filtered noise); two streamed assets carry the atmosphere: space_sound.mp3
 * (looping background ambience) and lighspeed_sound.mp3 (the hyperspace jump —
 * the warp visual is synced to this clip's ~13.5s length). Muted by default;
 * nothing plays before a user gesture (bible §11).
 */

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineNodes: { gain: GainNode; stop: () => void } | null = null;
  private muted = true;

  /** streamed audio assets (background ambience + hyperspace jump) */
  private bgMusic: HTMLAudioElement | null = null;
  private warpSound: HTMLAudioElement | null = null;
  /** measured length of the lightspeed clip — the warp visual is synced to it */
  warpDuration = 13.48;

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    this.initStreams();
  }

  /** lazily create the streamed <audio> elements (space ambience + warp) */
  private initStreams() {
    if (typeof window === 'undefined') return;
    if (!this.bgMusic) {
      const bg = new Audio('/space_sound.mp3');
      bg.loop = true;
      bg.preload = 'auto';
      bg.volume = 0.32;
      this.bgMusic = bg;
    }
    if (!this.warpSound) {
      const w = new Audio('/lighspeed_sound.mp3');
      w.preload = 'auto';
      w.volume = 0.6;
      w.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(w.duration) && w.duration > 0) this.warpDuration = w.duration;
      });
      this.warpSound = w;
    }
    if (!this.muted) void this.bgMusic.play().catch(() => {});
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.bgMusic) {
      if (muted) this.bgMusic.pause();
      else void this.bgMusic.play().catch(() => {});
    }
    if (this.warpSound && muted) this.warpSound.pause();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.5, t + 0.15);
  }

  private get ready() {
    return !!(this.ctx && this.master && !this.muted);
  }

  /** short sine/square blip — UI hover */
  blip(freq = 660) {
    this.tone({ freq, type: 'sine', dur: 0.06, gain: 0.12 });
  }

  /** rising two-note confirm — select/dock */
  confirm() {
    this.tone({ freq: 440, type: 'sine', dur: 0.07, gain: 0.14 });
    this.tone({ freq: 660, type: 'sine', dur: 0.1, gain: 0.14, delay: 0.07 });
  }

  error() {
    this.tone({ freq: 130, type: 'square', dur: 0.18, gain: 0.1 });
  }

  /** crisp digital UI tick — stepped square waves, no glide (bible §11) */
  click() {
    if (!this.ready || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // primary: high tick that steps down a fifth — reads as "data"
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1320, t);
    osc.frequency.setValueAtTime(880, t + 0.016);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.075, t);
    g.gain.setValueAtTime(0.075, t + 0.026);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.06);
    // shimmer harmonic for a bit-crushed edge
    const hi = ctx.createOscillator();
    hi.type = 'square';
    hi.frequency.setValueAtTime(2640, t);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.022, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
    hi.connect(g2).connect(this.master);
    hi.start(t);
    hi.stop(t + 0.035);
  }

  transmit() {
    this.tone({ freq: 520, type: 'sine', dur: 0.08, gain: 0.13 });
    this.tone({ freq: 780, type: 'sine', dur: 0.08, gain: 0.13, delay: 0.09 });
    this.tone({ freq: 1040, type: 'sine', dur: 0.16, gain: 0.13, delay: 0.18 });
  }

  /** boot: staggered rising tones like subsystems reporting in */
  powerUp() {
    [220, 330, 440, 587].forEach((f, i) =>
      this.tone({ freq: f, type: 'sine', dur: 0.12, gain: 0.1, delay: 0.3 + i * 0.35 }),
    );
  }

  /**
   * Hyperspace jump. The forward jump plays the recorded lightspeed clip
   * (the warp visual is synced to its length); the quick return-to-bridge
   * and reduced-motion jumps use a short synthesized whoosh instead.
   */
  warp(mini = false) {
    if (!mini) {
      const w = this.warpSound;
      if (w && !this.muted) {
        try {
          w.currentTime = 0;
          void w.play().catch(() => {});
        } catch {
          /* not yet loaded — silent, visual still runs */
        }
      }
      return;
    }
    if (!this.ready || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const dur = mini ? 0.7 : 1.4;
    const noise = this.noiseSource(dur + 0.2);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(200, t);
    filter.frequency.exponentialRampToValueAtTime(mini ? 1200 : 2400, t + dur * 0.6);
    filter.frequency.exponentialRampToValueAtTime(150, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(mini ? 0.18 : 0.3, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise.connect(filter).connect(g).connect(this.master);
    noise.start(t);
    noise.stop(t + dur + 0.1);
  }

  scanSweep() {
    if (!this.ready || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(1400, t + 0.55);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.linearRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.65);
  }

  laser() {
    if (!this.ready || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, t);
    osc.frequency.exponentialRampToValueAtTime(180, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  hit() {
    if (!this.ready || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = this.noiseSource(0.25);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, t);
    filter.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.22, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
    noise.connect(filter).connect(g).connect(this.master);
    noise.start(t);
    noise.stop(t + 0.25);
  }

  /** looping low engine hum while seated on the bridge / flying */
  engineIdle(on: boolean) {
    if (!this.ctx || !this.master) return;
    if (on && !this.engineNodes) {
      const ctx = this.ctx;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 42;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.4;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 3;
      lfo.connect(lfoGain).connect(osc.frequency);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.2);
      osc.connect(filter).connect(g).connect(this.master);
      osc.start();
      lfo.start();
      this.engineNodes = {
        gain: g,
        stop: () => {
          osc.stop();
          lfo.stop();
        },
      };
    } else if (!on && this.engineNodes) {
      const { gain, stop } = this.engineNodes;
      gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.6);
      window.setTimeout(stop, 700);
      this.engineNodes = null;
    }
  }

  private tone(opts: {
    freq: number;
    type: OscillatorType;
    dur: number;
    gain: number;
    delay?: number;
  }) {
    if (!this.ready || !this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    osc.type = opts.type;
    osc.frequency.value = opts.freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.dur);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + opts.dur + 0.02);
  }

  private noiseSource(dur: number): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    return src;
  }
}

export const audio = new AudioEngine();
