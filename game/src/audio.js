// Everything you hear is synthesised here: one AudioContext, oscillators and noise buffers,
// no audio files. Nothing runs until start() is called from the Play click.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this._engineGain = null;
    this._engineOsc = null;
    this._engineFilter = null;
  }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    this.master = ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(ctx.destination);

    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    this._engine();
    this._music();
    this.ready = true;
  }

  _engine() {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 46;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 320;
    f.Q.value = 5;
    const g = ctx.createGain();
    g.gain.value = 0;
    o.connect(f);
    f.connect(g);
    g.connect(this.master);
    o.start();
    this._engineOsc = o;
    this._engineFilter = f;
    this._engineGain = g;
  }

  engine(speed, on) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this._engineGain.gain.setTargetAtTime(on ? 0.03 + Math.min(0.07, speed * 0.002) : 0, t, 0.09);
    this._engineOsc.frequency.setTargetAtTime(44 + speed * 2.2, t, 0.12);
    this._engineFilter.frequency.setTargetAtTime(280 + speed * 20, t, 0.12);
  }

  _burst(dur, cut, vol, type = 'lowpass') {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = cut;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur);
  }

  gun() { this._burst(0.16, 1500, 0.42); this._burst(0.07, 340, 0.3); }
  punch() { this._burst(0.09, 240, 0.24); }
  crash() { this._burst(0.35, 520, 0.36); }
  step() { this._burst(0.05, 800, 0.045); }
  dry() { this._burst(0.04, 2600, 0.08, 'bandpass'); }

  horn() {
    if (!this.ready) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const hz of [392, 494]) {
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = hz;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + 0.02);
      g.gain.setValueAtTime(0.05, t + 0.26);
      g.gain.linearRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.34);
    }
  }

  // soft pad with a slow filter sweep, plus a lazy bass pulse
  _music() {
    const ctx = this.ctx;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 820;
    const gain = ctx.createGain();
    gain.gain.value = 0.045;
    filter.connect(gain);
    gain.connect(this.master);

    for (const hz of [98, 147, 196, 294]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = hz;
      o.connect(filter);
      o.start();
    }

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 240;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    const bass = ctx.createOscillator();
    bass.type = 'sine';
    bass.frequency.value = 49;
    const bassGain = ctx.createGain();
    bassGain.gain.value = 0;
    const pulse = ctx.createOscillator();
    pulse.frequency.value = 0.55;
    const pulseGain = ctx.createGain();
    pulseGain.gain.value = 0.02;
    pulse.connect(pulseGain);
    pulseGain.connect(bassGain.gain);
    bass.connect(bassGain);
    bassGain.connect(this.master);
    bass.start();
    pulse.start();
  }
}
