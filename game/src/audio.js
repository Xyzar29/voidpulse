// Tiny synthesised sound effects on WebAudio: no audio files, nothing to load.
// The context is created lazily on the first user gesture (browsers refuse it
// earlier), every effect is a few oscillators or a burst of filtered noise,
// and the whole bank can be muted with M. Sound is flavour only: the game is
// fully playable with it off or unavailable.

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.lastShootAt = 0;
  }

  /** Create the context on a user gesture; safe to call on every gesture. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.master.gain.value = 0.32;
    this.master.connect(this.context.destination);
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  tone({ frequency = 440, endFrequency = null, duration = 0.12, type = 'square', volume = 0.5, delay = 0 }) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    if (endFrequency !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(this.master);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  noise({ duration = 0.25, volume = 0.5, filterFrequency = 1200, delay = 0 }) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + delay;
    const frames = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, frames, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFrequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter).connect(gain).connect(this.master);
    source.start(start);
  }

  shoot() {
    // Throttled: at high fire rates the blips would stack into a buzz.
    const now = performance.now();
    if (now - this.lastShootAt < 45) return;
    this.lastShootAt = now;
    this.tone({ frequency: 880, endFrequency: 320, duration: 0.07, type: 'square', volume: 0.16 });
  }

  hit() {
    this.tone({ frequency: 220, endFrequency: 140, duration: 0.05, type: 'triangle', volume: 0.2 });
  }

  explode(big = false) {
    this.noise({ duration: big ? 0.5 : 0.22, volume: big ? 0.7 : 0.35, filterFrequency: big ? 700 : 1100 });
    this.tone({ frequency: big ? 120 : 180, endFrequency: 40, duration: big ? 0.45 : 0.2, type: 'sine', volume: 0.5 });
  }

  hurt() {
    this.tone({ frequency: 320, endFrequency: 60, duration: 0.3, type: 'sawtooth', volume: 0.5 });
    this.noise({ duration: 0.2, volume: 0.3, filterFrequency: 900 });
  }

  dash() {
    this.noise({ duration: 0.16, volume: 0.22, filterFrequency: 2600 });
  }

  shieldPop() {
    this.tone({ frequency: 520, endFrequency: 980, duration: 0.14, type: 'sine', volume: 0.4 });
  }

  upgrade() {
    [523, 659, 784, 1047].forEach((frequency, i) => {
      this.tone({ frequency, duration: 0.14, type: 'triangle', volume: 0.35, delay: i * 0.07 });
    });
  }

  alarm() {
    [0, 0.22].forEach((delay) => {
      this.tone({ frequency: 196, endFrequency: 196, duration: 0.18, type: 'sawtooth', volume: 0.3, delay });
    });
  }

  gameOver() {
    [392, 311, 233, 155].forEach((frequency, i) => {
      this.tone({ frequency, duration: 0.28, type: 'triangle', volume: 0.35, delay: i * 0.16 });
    });
  }
}
