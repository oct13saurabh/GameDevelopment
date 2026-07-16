// Procedural WebAudio SFX + background music synth. No audio files exist in
// either Kenney kit, so everything here is generated at runtime.

export default class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.masterGain = null;
  }

  ensureContext() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.35;
    this.masterGain.connect(this.ctx.destination);
  }

  resume() {
    this.ensureContext();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.muted ? 0 : 0.35;
    }
    return this.muted;
  }

  // --- low-level helpers -------------------------------------------------

  _osc({ type = 'sine', freqStart, freqEnd, duration, gainStart = 0.3, gainEnd = 0.0001 }) {
    this.ensureContext();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), now + duration);
    }
    gain.gain.setValueAtTime(gainStart, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(gainEnd, 0.0001), now + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  _noise({ duration, gainStart = 0.3, filterFreqStart = 2000, filterFreqEnd = 200 }) {
    this.ensureContext();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreqStart, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(filterFreqEnd, 10), now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainStart, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + duration + 0.02);
  }

  // --- SFX -----------------------------------------------------------------

  playerShoot() {
    this._osc({ type: 'square', freqStart: 880, freqEnd: 440, duration: 0.09, gainStart: 0.15 });
  }

  enemyShoot() {
    this._osc({ type: 'sawtooth', freqStart: 520, freqEnd: 220, duration: 0.1, gainStart: 0.1 });
  }

  explosionSmall() {
    this._noise({ duration: 0.25, gainStart: 0.3, filterFreqStart: 2500, filterFreqEnd: 150 });
  }

  explosionBig() {
    this._noise({ duration: 0.7, gainStart: 0.45, filterFreqStart: 3000, filterFreqEnd: 80 });
    this._osc({ type: 'sine', freqStart: 120, freqEnd: 30, duration: 0.6, gainStart: 0.3 });
  }

  hit() {
    this._osc({ type: 'triangle', freqStart: 300, freqEnd: 150, duration: 0.08, gainStart: 0.15 });
  }

  pickup() {
    this._osc({ type: 'sine', freqStart: 440, freqEnd: 880, duration: 0.15, gainStart: 0.2 });
  }

  playerHurt() {
    this._osc({ type: 'sawtooth', freqStart: 200, freqEnd: 80, duration: 0.3, gainStart: 0.25 });
  }

  bossWarning() {
    this._osc({ type: 'square', freqStart: 220, freqEnd: 220, duration: 0.4, gainStart: 0.2 });
  }

  // Short rising blip fired just before a telegraphed boss attack releases.
  bossTelegraph() {
    this._osc({ type: 'triangle', freqStart: 300, freqEnd: 700, duration: 0.15, gainStart: 0.12 });
  }

  missionComplete() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => {
      setTimeout(() => this._osc({ type: 'triangle', freqStart: f, freqEnd: f, duration: 0.3, gainStart: 0.25 }), i * 140);
    });
  }

  gameOverJingle() {
    const notes = [392, 349.23, 311.13, 261.63];
    notes.forEach((f, i) => {
      setTimeout(() => this._osc({ type: 'sawtooth', freqStart: f, freqEnd: f * 0.9, duration: 0.35, gainStart: 0.2 }), i * 180);
    });
  }

  // --- Background music ----------------------------------------------------
  // Simple looping arpeggio, scheduled with setInterval-driven note bursts.

  startMusic() {
    this.stopMusic();
    this.ensureContext();
    const pattern = [220, 277.18, 329.63, 277.18, 220, 261.63, 329.63, 392];
    let i = 0;
    this.musicTimer = window.setInterval(() => {
      if (this.muted) { i = (i + 1) % pattern.length; return; }
      const f = pattern[i % pattern.length];
      this._osc({ type: 'triangle', freqStart: f, freqEnd: f, duration: 0.5, gainStart: 0.05, gainEnd: 0.0001 });
      i++;
    }, 260);
  }

  stopMusic() {
    if (this.musicTimer) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
