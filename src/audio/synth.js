// Instrument and sound-design voices built on an OfflineAudioContext.
// Everything is synthesised; randomness is seeded so renders are repeatable.

import { mulberry32 } from '../core/math.js';
import { BEAT } from '../config.js';

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.sr = ctx.sampleRate;
    this.rand = mulberry32(424242);
    this.noise = this.makeNoise(6, 'white');
    this.pink = this.makeNoise(6, 'pink');
    this.ksCache = new Map();
    this.buildBuses();
  }

  // ---- infrastructure -----------------------------------------------------
  makeNoise(seconds, kind) {
    const n = Math.floor(seconds * this.sr);
    const b = this.ctx.createBuffer(2, n, this.sr);
    const r = mulberry32(kind === 'pink' ? 11 : 7);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = r() * 2 - 1;
        if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
        } else d[i] = w;
      }
    }
    return b;
  }

  impulse(seconds, decay, preDelay = 0.015, bright = 1) {
    const n = Math.floor(seconds * this.sr);
    const b = this.ctx.createBuffer(2, n, this.sr);
    const r = mulberry32(Math.floor(seconds * 1000));
    const pd = Math.floor(preDelay * this.sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      let lp = 0;
      for (let i = pd; i < n; i++) {
        const t = (i - pd) / this.sr;
        const env = Math.pow(1 - (i - pd) / (n - pd), 2) * Math.exp(-t * decay);
        // darken the tail over time (air absorption)
        const a = Math.min(0.95, 0.15 + t * 0.9 / bright);
        lp = lp * a + (r() * 2 - 1) * (1 - a);
        d[i] = lp * env * 2.2;
      }
    }
    return b;
  }

  buildBuses() {
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 24; hp.Q.value = 0.7;
    const glue = c.createDynamicsCompressor();
    glue.threshold.value = -16; glue.ratio.value = 2.5; glue.knee.value = 8; glue.attack.value = 0.012; glue.release.value = 0.18;
    this.master.connect(hp).connect(glue).connect(c.destination);
    // groove path: drums + ducked music share a filter (neighbour's-wall muffle)
    this.wall = c.createBiquadFilter(); this.wall.type = 'lowpass'; this.wall.frequency.value = 20000; this.wall.Q.value = 0.9;
    this.wall.connect(this.master);
    this.drums = c.createGain(); this.drums.connect(this.wall);
    this.duck = c.createGain(); this.duck.connect(this.wall);
    this.music = c.createGain(); this.music.connect(this.duck);
    // stereo chorus on the music bus (above 260 Hz, so the low end stays mono)
    const chHp = c.createBiquadFilter(); chHp.type = 'highpass'; chHp.frequency.value = 260;
    const chIn = c.createGain(); chIn.gain.value = 0.55;
    this.music.connect(chHp).connect(chIn);
    const merge = c.createChannelMerger(2);
    [[0.011, 0.37, 0], [0.017, 0.29, 1]].forEach(([base, rate, ch]) => {
      const d = c.createDelay(0.05); d.delayTime.value = base;
      const lfo = c.createOscillator(); lfo.frequency.value = rate;
      const lg = c.createGain(); lg.gain.value = 0.0035;
      lfo.connect(lg).connect(d.delayTime); lfo.start(0);
      const mono = c.createGain(); mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers';
      chIn.connect(mono).connect(d).connect(merge, 0, ch);
    });
    merge.connect(this.duck);
    this.airy = c.createGain(); this.airy.connect(this.master); // un-ducked intro/outro music
    this.fx = c.createGain(); this.fx.connect(this.master);
    this.amb = c.createGain(); this.amb.connect(this.master);
    this.hall = c.createConvolver(); this.hall.buffer = this.impulse(3.6, 1.5, 0.025, 1.2);
    this.hallIn = c.createGain(); this.hallIn.connect(this.hall); this.hall.connect(this.master);
    this.room = c.createConvolver(); this.room.buffer = this.impulse(1.1, 5, 0.008, 1.6);
    this.roomIn = c.createGain(); this.roomIn.connect(this.room); this.room.connect(this.master);
    // ping-pong delay for plucks
    const dl = c.createDelay(1), dr = c.createDelay(1);
    // dotted-eighth ping-pong at the groove tempo
    dl.delayTime.value = BEAT * 0.75; dr.delayTime.value = BEAT * 0.75;
    const fb = c.createGain(); fb.gain.value = 0.34;
    const dlp = c.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
    const merger = c.createChannelMerger(2);
    this.delayIn = c.createGain();
    this.delayIn.connect(dl);
    dl.connect(dr); dr.connect(dlp); dlp.connect(fb); fb.connect(dl);
    dl.connect(merger, 0, 0); dr.connect(merger, 0, 1);
    const dOut = c.createGain(); dOut.gain.value = 0.55;
    merger.connect(dOut).connect(this.master);
    dOut.connect(this.hallIn);
  }

  send(node, { hall = 0, room = 0, delay = 0 } = {}) {
    if (hall) { const g = this.ctx.createGain(); g.gain.value = hall; node.connect(g).connect(this.hallIn); }
    if (room) { const g = this.ctx.createGain(); g.gain.value = room; node.connect(g).connect(this.roomIn); }
    if (delay) { const g = this.ctx.createGain(); g.gain.value = delay; node.connect(g).connect(this.delayIn); }
  }

  pan(node, p) {
    const s = this.ctx.createStereoPanner();
    s.pan.value = p;
    node.connect(s);
    return s;
  }

  shaper(amount = 2) {
    const s = this.ctx.createWaveShaper();
    const n = 2048, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    s.curve = curve;
    s.oversample = '2x';
    return s;
  }

  noiseSrc(t, dur, pink = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = pink ? this.pink : this.noise;
    const off = this.rand() * (s.buffer.duration - dur - 0.1);
    s.start(t, Math.max(0, off), dur + 0.05);
    return s;
  }

  env(g, t, { a = 0.002, peak = 1, d = 0.2, hold = 0, curve = 'exp' } = {}) {
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (hold) g.gain.setValueAtTime(peak, t + a + hold);
    if (curve === 'exp') g.gain.setTargetAtTime(0, t + a + hold, d / 3);
    else g.gain.linearRampToValueAtTime(0, t + a + hold + d);
  }

  // ---- drums ----------------------------------------------------------------
  kick(t, v = 1, { f0 = 170, f1 = 50, decay = 0.34, click = 0.35, out = this.drums } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.075);
    o.frequency.exponentialRampToValueAtTime(f1 * 0.85, t + decay);
    const g = c.createGain();
    this.env(g, t, { a: 0.0015, peak: v, d: decay });
    const sh = this.shaper(1.8);
    o.connect(sh).connect(g).connect(out);
    o.start(t); o.stop(t + decay * 2 + 0.1);
    const n = this.noiseSrc(t, 0.02);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    const ng = c.createGain();
    this.env(ng, t, { a: 0.0005, peak: click * v, d: 0.012 });
    n.connect(hp).connect(ng).connect(out);
  }

  clap(t, v = 1, { out = this.drums, room = 0.35 } = {}) {
    const c = this.ctx;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1350; bp.Q.value = 1.1;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 600;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    [0, 0.010, 0.021].forEach((o) => {
      g.gain.setValueAtTime(0, t + o);
      g.gain.linearRampToValueAtTime(v, t + o + 0.0012);
      g.gain.setTargetAtTime(0, t + o + 0.0012, 0.0035);
    });
    g.gain.setValueAtTime(0, t + 0.031);
    g.gain.linearRampToValueAtTime(v * 0.9, t + 0.0325);
    g.gain.setTargetAtTime(0, t + 0.0325, 0.055);
    const n = this.noiseSrc(t, 0.4);
    n.connect(bp).connect(hp).connect(g).connect(out);
    this.send(g, { room });
  }

  snare(t, v = 1, { tone = 190, out = this.drums, room = 0.3, decay = 0.16 } = {}) {
    const c = this.ctx;
    const n = this.noiseSrc(t, decay * 2 + 0.05);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    const pk = c.createBiquadFilter(); pk.type = 'peaking'; pk.frequency.value = 4500; pk.gain.value = 4;
    const g = c.createGain();
    this.env(g, t, { a: 0.001, peak: v * 0.8, d: decay });
    n.connect(hp).connect(pk).connect(g).connect(out);
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(tone, t); o.frequency.exponentialRampToValueAtTime(tone * 0.82, t + 0.06);
    const og = c.createGain();
    this.env(og, t, { a: 0.001, peak: v * 0.55, d: 0.07 });
    o.connect(og).connect(out);
    o.start(t); o.stop(t + 0.3);
    this.send(g, { room });
  }

  hat(t, v = 1, open = false, p = 0.15) {
    const c = this.ctx;
    const d = open ? 0.2 : 0.03;
    const n = this.noiseSrc(t, d * 3 + 0.02);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7200;
    const bp = c.createBiquadFilter(); bp.type = 'peaking'; bp.frequency.value = 10500; bp.gain.value = 5; bp.Q.value = 0.8;
    const g = c.createGain();
    this.env(g, t, { a: 0.0008, peak: v, d });
    this.pan(n.connect(hp).connect(bp).connect(g), p).connect(this.drums);
  }

  crash(t, v = 1, { dur = 2.2, out = this.drums, hall = 0.25 } = {}) {
    const c = this.ctx;
    const n = this.noiseSrc(t, dur * 2);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3800;
    const sh = c.createBiquadFilter(); sh.type = 'highshelf'; sh.frequency.value = 9000; sh.gain.value = -4;
    const g = c.createGain();
    this.env(g, t, { a: 0.002, peak: v, d: dur });
    n.connect(hp).connect(sh).connect(g).connect(out);
    [3.1, 4.7, 6.3, 8.2].forEach((r, i) => {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 330 * r + i * 13;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 6000 + i * 900; bp.Q.value = 3;
      const og = c.createGain();
      this.env(og, t, { a: 0.002, peak: v * 0.05, d: dur * 0.5 });
      o.connect(bp).connect(og).connect(out);
      o.start(t); o.stop(t + dur);
    });
    this.send(g, { hall });
  }

  boom(t, v = 1, { f0 = 62, f1 = 30, dur = 2.0, hall = 0.12 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f0 * 2.2, t);
    o.frequency.exponentialRampToValueAtTime(f0, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    this.env(g, t, { a: 0.003, peak: v, d: dur });
    o.connect(this.shaper(2.4)).connect(g).connect(this.fx);
    o.start(t); o.stop(t + dur * 1.6);
    const n = this.noiseSrc(t, 1.2, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(2400, t); lp.frequency.exponentialRampToValueAtTime(120, t + 0.5);
    const ng = c.createGain();
    this.env(ng, t, { a: 0.002, peak: v * 0.9, d: 0.5 });
    n.connect(lp).connect(ng).connect(this.fx);
    this.send(ng, { hall });
  }

  // ---- tonal ---------------------------------------------------------------
  bass(t, midi, dur, v = 1) {
    const c = this.ctx;
    const f = mtof(midi);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.linearRampToValueAtTime(1100, t + 0.012);
    lp.frequency.setTargetAtTime(260, t + 0.012, 0.06);
    const g = c.createGain();
    this.env(g, t, { a: 0.003, peak: v * 0.32, hold: dur * 0.55, d: dur * 0.45, curve: 'lin' });
    for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.1);
    }
    lp.connect(this.shaper(1.4)).connect(g).connect(this.music);
    const sub = c.createOscillator(); sub.frequency.value = f / 2;
    const sg = c.createGain();
    this.env(sg, t, { a: 0.004, peak: v * 0.5, hold: dur * 0.6, d: dur * 0.4, curve: 'lin' });
    sub.connect(sg).connect(this.music);
    sub.start(t); sub.stop(t + dur + 0.1);
  }

  supersaw(t, notes, dur, v = 1, { cutoff = 5200, end = 900, out = this.music, hall = 0.22, attack = 0.003, spread = 0.95, voices = 5 } = {}) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(end, t + Math.min(dur, 0.35));
    const g = c.createGain();
    this.env(g, t, { a: attack, peak: v * 0.07, hold: dur * 0.3, d: dur * 0.7 });
    lp.connect(g).connect(out);
    const dets = voices === 7 ? [-19, -12, -6, 0, 6, 12, 19] : [-16, -7, 0, 7, 16];
    notes.forEach((m) => {
      dets.forEach((d, i) => {
        const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = d;
        const p = ((i / (dets.length - 1)) * 2 - 1) * spread;
        this.pan(o, p).connect(lp);
        o.start(t); o.stop(t + dur + 0.6);
      });
    });
    this.send(g, { hall });
    return g;
  }

  pad(t0, t1, notes, v = 1, { cutoff = 1300, out = this.airy, hall = 0.55, attack = 0.9, release = 1.4 } = {}) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(cutoff * 0.5, t0);
    lp.frequency.linearRampToValueAtTime(cutoff, t0 + attack * 1.5);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v * 0.045, t0 + attack);
    g.gain.setValueAtTime(v * 0.045, t1);
    g.gain.setTargetAtTime(0, t1, release / 3);
    lp.connect(g).connect(out);
    notes.forEach((m, ni) => {
      [-9, 0, 9].forEach((d, i) => {
        const o = c.createOscillator(); o.type = i === 1 ? 'triangle' : 'sawtooth';
        o.frequency.value = mtof(m); o.detune.value = d + (ni % 2 ? 2 : -2);
        this.pan(o, (i - 1) * 0.6).connect(lp);
        o.start(t0); o.stop(t1 + release * 1.5);
      });
    });
    this.send(g, { hall });
    return g;
  }

  /** Karplus–Strong string (two detuned courses, santoor-like hammer). */
  ksBuffer(midi, dur = 2.4, bright = 0.6) {
    const key = `${midi}|${dur}|${bright}`;
    if (this.ksCache.has(key)) return this.ksCache.get(key);
    const sr = this.sr, n = Math.floor(dur * sr);
    const b = this.ctx.createBuffer(1, n, sr);
    const out = b.getChannelData(0);
    const r = mulberry32(midi * 31 + 7);
    for (const detune of [-2.5, 2.5]) {
      const f = mtof(midi) * Math.pow(2, detune / 1200);
      const N = sr / f;
      const L = Math.floor(N), frac = N - L;
      const line = new Float32Array(L + 1);
      let lp = 0;
      for (let i = 0; i < line.length; i++) { const w = r() * 2 - 1; lp = lp + (w - lp) * bright; line[i] = lp; }
      let idx = 0, prev = 0;
      // loss per period chosen for a ~1.6 s decay regardless of pitch
      const g = Math.pow(0.001, 1 / (1.6 * f));
      for (let i = 0; i < n; i++) {
        const a = line[idx], bb = line[(idx + 1) % line.length];
        const y = a * (1 - frac) + bb * frac;
        line[idx] = ((y + prev) * 0.5) * g;
        prev = y;
        idx = (idx + 1) % line.length;
        out[i] += y * 0.5;
      }
    }
    for (let i = 0; i < Math.min(n, sr * 0.006); i++) out[i] += (r() * 2 - 1) * (1 - i / (sr * 0.006)) * 0.25;
    for (let i = n - Math.floor(sr * 0.2); i < n; i++) out[i] *= (n - i) / (sr * 0.2);
    this.ksCache.set(key, b);
    return b;
  }

  pluck(t, midi, v = 1, { pan = 0, out = this.airy, hall = 0.35, delay = 0.18, dur = 2.4, bright = 0.6 } = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.ksBuffer(midi, dur, bright);
    const g = this.ctx.createGain(); g.gain.value = v * 0.42;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 160;
    const o = this.pan(s.connect(hp).connect(g), pan);
    o.connect(out);
    this.send(o, { hall, delay });
    s.start(t);
  }

  bell(t, midi, v = 1, { pan = 0, hall = 0.5, dur = 2.5 } = {}) {
    const c = this.ctx;
    const f = mtof(midi);
    const out = c.createGain();
    const pn = this.pan(out, pan);
    pn.connect(this.airy);
    this.send(pn, { hall });
    [[1, 1, dur], [2.76, 0.45, dur * 0.5], [5.4, 0.25, dur * 0.25], [8.93, 0.12, dur * 0.12]].forEach(([r, a, d]) => {
      const o = c.createOscillator(); o.frequency.value = f * r;
      const g = c.createGain();
      this.env(g, t, { a: 0.002, peak: v * a * 0.09, d });
      o.connect(g).connect(out);
      o.start(t); o.stop(t + d + 0.2);
    });
  }

  whistle(t, notes, stepDur, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator();
    const vib = c.createOscillator(); vib.frequency.value = 5.8;
    const vg = c.createGain(); vg.gain.value = 9;
    vib.connect(vg).connect(o.detune);
    notes.forEach((m, i) => {
      const tt = t + i * stepDur;
      if (i === 0) o.frequency.setValueAtTime(mtof(m), tt);
      else o.frequency.setTargetAtTime(mtof(m), tt, 0.012);
    });
    const end = t + notes.length * stepDur;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * 0.05, t + 0.03);
    g.gain.setValueAtTime(v * 0.05, end - 0.05);
    g.gain.linearRampToValueAtTime(0, end + 0.08);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.5;
    o.connect(bp).connect(g).connect(this.music);
    this.send(g, { hall: 0.25, room: 0.3 });
    o.start(t); vib.start(t); o.stop(end + 0.2); vib.stop(end + 0.2);
    const n = this.noiseSrc(t, end - t + 0.1);
    const nb = c.createBiquadFilter(); nb.type = 'bandpass'; nb.frequency.value = 2400; nb.Q.value = 1.5;
    const ng = c.createGain(); ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(v * 0.006, t + 0.03); ng.gain.linearRampToValueAtTime(0, end + 0.05);
    n.connect(nb).connect(ng).connect(this.music);
  }

  hum(t0, t1, midi, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    const vib = c.createOscillator(); vib.frequency.value = 5.2;
    const vg = c.createGain(); vg.gain.value = 6;
    vib.connect(vg).connect(o.detune);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.7;
    const f1 = c.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = 300; f1.gain.value = 9; f1.Q.value = 2;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(v * 0.035, t0 + 0.35);
    g.gain.setValueAtTime(v * 0.035, t1 - 0.3);
    g.gain.linearRampToValueAtTime(0, t1);
    o.connect(lp).connect(f1).connect(g).connect(this.airy);
    this.send(g, { hall: 0.6 });
    o.start(t0); vib.start(t0); o.stop(t1 + 0.1); vib.stop(t1 + 0.1);
  }

  // ---- fx ------------------------------------------------------------------
  whoosh(t, dur, v = 1, { f0 = 300, f1 = 4000, p0 = -0.7, p1 = 0.7, q = 1.2, hall = 0.2 } = {}) {
    const c = this.ctx;
    const n = this.noiseSrc(t, dur + 0.1, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v * 0.9, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0, t + dur);
    const pn = c.createStereoPanner();
    pn.pan.setValueAtTime(p0, t); pn.pan.linearRampToValueAtTime(p1, t + dur);
    n.connect(bp).connect(g).connect(pn).connect(this.fx);
    this.send(pn, { hall });
  }

  riser(t0, t1, v = 1, { hall = 0.35 } = {}) {
    const c = this.ctx;
    const n = this.noiseSrc(t0, t1 - t0 + 0.1);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueAtTime(350, t0); bp.frequency.exponentialRampToValueAtTime(7500, t1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v * 0.5, t1 - 0.01); g.gain.linearRampToValueAtTime(0, t1);
    n.connect(bp).connect(g).connect(this.fx);
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t0); o.frequency.exponentialRampToValueAtTime(980, t1);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, t0); lp.frequency.exponentialRampToValueAtTime(5000, t1);
    const og = c.createGain();
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(v * 0.05, t1 - 0.01); og.gain.linearRampToValueAtTime(0, t1);
    o.connect(lp).connect(og).connect(this.fx);
    o.start(t0); o.stop(t1 + 0.05);
    this.send(g, { hall });
  }

  reverseSwell(t1, dur, v = 1) {
    const c = this.ctx, t0 = t1 - dur;
    const n = this.noiseSrc(t0, dur + 0.05);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.setValueAtTime(1500, t0); hp.frequency.exponentialRampToValueAtTime(5000, t1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v * 0.35, t1 - 0.005); g.gain.linearRampToValueAtTime(0, t1);
    n.connect(hp).connect(g).connect(this.fx);
    this.send(g, { hall: 0.3 });
  }

  zap(t, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(1600, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = c.createGain(); this.env(g, t, { a: 0.002, peak: v * 0.3, d: 0.14 });
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + 0.3);
    const n = this.noiseSrc(t, 0.08);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3000; bp.Q.value = 0.8;
    const ng = c.createGain(); this.env(ng, t, { a: 0.001, peak: v * 0.12, d: 0.06 });
    n.connect(bp).connect(ng).connect(this.fx);
  }

  click(t, v = 1, { f = 3500, pan = 0, out = this.fx, room = 0.15 } = {}) {
    const c = this.ctx;
    const n = this.noiseSrc(t, 0.02);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = 2.5;
    const g = c.createGain(); this.env(g, t, { a: 0.0004, peak: v, d: 0.008 });
    const o = c.createOscillator(); o.frequency.value = f * 0.5;
    const og = c.createGain(); this.env(og, t, { a: 0.0004, peak: v * 0.25, d: 0.006 });
    o.connect(og);
    const mix = c.createGain();
    n.connect(bp).connect(g).connect(mix); og.connect(mix);
    this.pan(mix, pan).connect(out);
    this.send(mix, { room });
    o.start(t); o.stop(t + 0.03);
  }

  pop(t, v = 1, { f0 = 900, f1 = 1700, pan = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.035);
    const g = c.createGain(); this.env(g, t, { a: 0.002, peak: v * 0.22, d: 0.07 });
    const o2 = c.createOscillator(); o2.type = 'triangle';
    o2.frequency.setValueAtTime(f0 * 2, t); o2.frequency.exponentialRampToValueAtTime(f1 * 2, t + 0.03);
    const g2 = c.createGain(); this.env(g2, t, { a: 0.002, peak: v * 0.05, d: 0.04 });
    const pn = c.createStereoPanner(); pn.pan.value = pan;
    o.connect(g).connect(pn); o2.connect(g2).connect(pn);
    pn.connect(this.fx);
    this.send(pn, { room: 0.25 });
    o.start(t); o2.start(t); o.stop(t + 0.2); o2.stop(t + 0.2);
  }

  waterDrop(t, v = 1, { f0 = 800, f1 = 2000, pan = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + 0.022);
    const g = c.createGain(); this.env(g, t, { a: 0.001, peak: v * 0.4, d: 0.07 });
    const pn = c.createStereoPanner(); pn.pan.value = pan;
    o.connect(g).connect(pn).connect(this.amb);
    this.send(pn, { hall: 0.7, delay: 0.1 });
    o.start(t); o.stop(t + 0.25);
  }

  micTap(t, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.08);
    const g = c.createGain(); this.env(g, t, { a: 0.001, peak: v * 0.8, d: 0.16 });
    o.connect(this.shaper(2.5)).connect(g).connect(this.fx);
    o.start(t); o.stop(t + 0.4);
    const n = this.noiseSrc(t, 0.08, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const ng = c.createGain(); this.env(ng, t, { a: 0.001, peak: v * 0.9, d: 0.05 });
    n.connect(lp).connect(ng).connect(this.fx);
    const hn = this.noiseSrc(t, 0.02);
    const hb = c.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 2200; hb.Q.value = 1;
    const hg = c.createGain(); this.env(hg, t, { a: 0.0005, peak: v * 0.08, d: 0.01 });
    hn.connect(hb).connect(hg).connect(this.fx);
    this.send(g, { room: 0.5 }); this.send(ng, { room: 0.5 });
  }

  /** Band-passed noise with a random-walk centre: river, wind, shower. */
  texture(t0, t1, { v = 1, f = [400, 1200], q = 1, lfo = 1.5, pink = true, out = this.amb, pan = 0, gainCurve = null, hall = 0.2, seed = 1 } = {}) {
    const c = this.ctx, dur = t1 - t0;
    const n = this.noiseSrc(t0, dur + 0.1, pink);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    const r = mulberry32(seed);
    const steps = Math.max(4, Math.floor(dur * lfo * 4));
    const curve = new Float32Array(steps);
    let x = r();
    for (let i = 0; i < steps; i++) { x = Math.min(1, Math.max(0, x + (r() - 0.5) * 0.5)); curve[i] = f[0] * Math.pow(f[1] / f[0], x); }
    bp.frequency.setValueCurveAtTime(curve, t0, dur);
    const g = c.createGain();
    if (gainCurve) g.gain.setValueCurveAtTime(Float32Array.from(gainCurve, (y) => y * v), t0, dur);
    else { g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + dur * 0.3); g.gain.linearRampToValueAtTime(0, t1); }
    const pn = c.createStereoPanner(); pn.pan.value = pan;
    n.connect(bp).connect(g).connect(pn).connect(out);
    this.send(pn, { hall });
  }

  bird(t, v = 1, { pan = 0.3, base = 3600 } = {}) {
    const c = this.ctx;
    const r = this.rand;
    const notes = 2 + Math.floor(r() * 3);
    let tt = t;
    for (let k = 0; k < notes; k++) {
      const d = 0.05 + r() * 0.05;
      const o = c.createOscillator();
      const f0 = base * (0.9 + r() * 0.4), f1 = f0 * (1.25 + r() * 0.4);
      const curve = new Float32Array(24);
      for (let i = 0; i < 24; i++) { const u = i / 23; curve[i] = f0 + (f1 - f0) * Math.sin(Math.PI * u) + 120 * Math.sin(u * 40); }
      o.frequency.setValueCurveAtTime(curve, tt, d);
      const g = c.createGain(); this.env(g, tt, { a: 0.004, peak: v * 0.06, d: d * 0.9, hold: d * 0.3 });
      const pn = c.createStereoPanner(); pn.pan.value = pan;
      o.connect(g).connect(pn).connect(this.amb);
      this.send(pn, { hall: 0.45 });
      o.start(tt); o.stop(tt + d + 0.1);
      tt += d + 0.03 + r() * 0.05;
    }
  }

  /** Leaves rustling that turns into an audience applauding (grain synthesis). */
  applauseBuffer(dur, morph) {
    const sr = this.sr, n = Math.floor(dur * sr);
    const b = this.ctx.createBuffer(2, n, sr);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    const r = mulberry32(2024);
    const grain = (start, len, amp, fc, pan, sharp) => {
      const w = 2 * Math.PI * fc / sr, rr = 0.97 - 0.2 * (fc / 8000);
      const a1 = -2 * rr * Math.cos(w), a2 = rr * rr;
      let y1 = 0, y2 = 0;
      const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
      for (let i = 0; i < len && start + i < n; i++) {
        const e = sharp ? Math.exp(-i / (len * 0.18)) * Math.min(1, i / 12) : Math.sin(Math.PI * i / len);
        const x = (r() * 2 - 1) * e;
        const y = x - a1 * y1 - a2 * y2;
        y2 = y1; y1 = y;
        const s = y * amp * (1 - rr) * 2.2;
        L[start + i] += s * gl; R[start + i] += s * gr;
      }
    };
    for (let t = 0; t < dur; t += 0.0012 + r() * 0.004) {
      const m = morph(t);
      if (r() > m.rustle) continue;
      grain(Math.floor(t * sr), Math.floor((0.004 + r() * 0.01) * sr), 0.25 * m.rustleAmp, 2500 + r() * 5500, r() * 2 - 1, false);
    }
    for (let p = 0; p < 34; p++) {
      const rate = 4.2 + r() * 2.6;
      const fc = 900 + r() * 1600;
      const pan = r() * 1.8 - 0.9;
      const amp = 0.5 + r() * 0.6;
      let t = r() / rate;
      while (t < dur) {
        const m = morph(t);
        if (m.clap > 0.02 && r() < m.clap) grain(Math.floor(t * sr), Math.floor((0.012 + r() * 0.012) * sr), amp * m.clap, fc * (0.9 + r() * 0.2), pan, true);
        t += (1 / rate) * (0.85 + r() * 0.3);
      }
    }
    return b;
  }

  /** Vinyl scratch: a formant "ahh" read back and forth by a moving stylus. */
  scratchBuffer(dur, strokes = 3) {
    const sr = this.sr, n = Math.floor(dur * sr);
    const srcLen = Math.floor(0.6 * sr);
    const src = new Float32Array(srcLen);
    let ph1 = 0, ph2 = 0, lp = 0;
    for (let i = 0; i < srcLen; i++) {
      ph1 = (ph1 + 220 / sr) % 1; ph2 = (ph2 + 330 / sr) % 1;
      const x = (ph1 * 2 - 1) * 0.6 + (ph2 * 2 - 1) * 0.4;
      lp += (x - lp) * 0.25;
      src[i] = lp;
    }
    const b = this.ctx.createBuffer(2, n, sr);
    const L = b.getChannelData(0), R = b.getChannelData(1);
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const pos = (0.25 + 0.2 * Math.sin(u * Math.PI * 2 * strokes)) * srcLen;
      const vel = Math.abs(Math.cos(u * Math.PI * 2 * strokes));
      const i0 = Math.floor(pos), f = pos - i0;
      const s = src[i0 % srcLen] * (1 - f) + src[(i0 + 1) % srcLen] * f;
      const gate = Math.min(1, vel * 3) * Math.sin(Math.PI * u);
      L[i] = s * gate * 0.8; R[i] = s * gate * 0.8;
    }
    return b;
  }

  playBuffer(t, buffer, v = 1, { out = this.fx, hall = 0, room = 0, pan = 0, hp = 0 } = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    const g = this.ctx.createGain(); g.gain.value = v;
    let node = s;
    if (hp) { const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; node = node.connect(f); }
    const pn = this.pan(node.connect(g), pan);
    pn.connect(out);
    this.send(pn, { hall, room });
    s.start(t);
    return g;
  }

  // ---- nature & foley (v2) ------------------------------------------------------
  /** Tanpura drone on Sa (D): Pa–Sa–Sa–low Sa, with a buzzing jawari bridge. */
  tanpura(t0, t1, v = 1, { cycle = 1.6, pan = 0 } = {}) {
    const c = this.ctx;
    const bus = c.createGain(); bus.gain.value = v;
    const buzz = c.createBiquadFilter(); buzz.type = 'peaking'; buzz.frequency.value = 2400; buzz.Q.value = 1.2; buzz.gain.value = 7;
    const sh = this.shaper(1.5);
    const out = this.pan(bus.connect(sh).connect(buzz), pan);
    out.connect(this.airy);
    this.send(out, { hall: 0.45 });
    const notes = [45, 50, 50, 38];
    for (let t = t0, k = 0; t < t1; t += cycle / 4, k++) {
      const s = c.createBufferSource();
      s.buffer = this.ksBuffer(notes[k % 4], 3.0, 0.32);
      const g = c.createGain(); g.gain.value = 0.28 * (k % 4 === 3 ? 1.2 : 1);
      s.connect(g).connect(bus);
      s.start(t);
    }
  }

  thunder(t, v = 1, { dur = 3.2, crack = 1 } = {}) {
    const c = this.ctx;
    if (crack > 0) {
      const n = this.noiseSrc(t, 0.4);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 500;
      const g = c.createGain(); this.env(g, t, { a: 0.002, peak: v * 0.55 * crack, d: 0.35 });
      n.connect(hp).connect(g).connect(this.fx);
      this.send(g, { hall: 0.5 });
    }
    const r = this.noiseSrc(t, dur + 0.2, true);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(700, t); lp.frequency.exponentialRampToValueAtTime(110, t + dur);
    const g = c.createGain();
    const curve = new Float32Array(48);
    for (let i = 0; i < 48; i++) { const u = i / 47; curve[i] = v * 1.3 * Math.min(1, u * 12) * Math.exp(-u * 3.2) * (0.6 + 0.4 * Math.abs(Math.sin(u * 23 + i))); }
    g.gain.setValueCurveAtTime(curve, t, dur);
    r.connect(lp).connect(this.shaper(1.4)).connect(g).connect(this.fx);
    this.send(g, { hall: 0.3 });
    this.boom(t + 0.02, v * 0.5, { f0: 48, f1: 26, dur: dur * 0.6, hall: 0.2 });
  }

  rainBed(t0, t1, v = 1, { fadeIn = 0.2, fadeOut = 0.05 } = {}) {
    const c = this.ctx, dur = t1 - t0;
    const n = this.noiseSrc(t0, dur + 0.1, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.5;
    const n2 = this.noiseSrc(t0, dur + 0.1);
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 6000;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(v, t0 + fadeIn);
    g.gain.setValueAtTime(v, t1 - fadeOut); g.gain.linearRampToValueAtTime(0, t1);
    const g2 = c.createGain(); g2.gain.value = 0.35;
    n.connect(bp).connect(g); n2.connect(hp).connect(g2).connect(g);
    g.connect(this.amb);
    this.send(g, { hall: 0.25 });
    // individual drops ticking on leaves and water
    const r = mulberry32(99);
    for (let t = t0 + 0.05; t < t1 - 0.05; t += 0.012 + r() * 0.03) {
      const f = 1800 + r() * 5000;
      this.click(t, v * (0.08 + r() * 0.12), { f, pan: r() * 1.6 - 0.8, out: this.amb, room: 0.05 });
    }
  }

  crickets(t0, t1, v = 1) {
    const c = this.ctx;
    const r = mulberry32(314);
    for (let k = 0; k < 3; k++) {
      const o = c.createOscillator(); o.frequency.value = 4200 + k * 330 + r() * 100;
      const g = c.createGain(); g.gain.value = 0;
      const pn = c.createStereoPanner(); pn.pan.value = [-0.6, 0.5, 0.1][k];
      o.connect(g).connect(pn).connect(this.amb);
      this.send(pn, { hall: 0.3 });
      let t = t0 + r() * 0.3;
      while (t < t1 - 0.2) {
        for (let p = 0; p < 4; p++) {
          const tp = t + p * 0.038;
          g.gain.setValueAtTime(0, tp); g.gain.linearRampToValueAtTime(v * 0.028, tp + 0.006); g.gain.linearRampToValueAtTime(0, tp + 0.024);
        }
        t += 0.42 + r() * 0.25;
      }
      o.start(t0); o.stop(t1);
    }
  }

  /** Asian koel: a short "ku" then a long rising "OO". */
  koel(t, v = 1, { pitch = 1, pan = 0.35 } = {}) {
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = v;
    const pn = this.pan(out, pan); pn.connect(this.amb); this.send(pn, { hall: 0.6 });
    const note = (t0, d, f0, f1) => {
      const o = c.createOscillator(); o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + d * 0.85);
      const vib = c.createOscillator(); vib.frequency.value = 7; const vg = c.createGain(); vg.gain.value = f0 * 0.012;
      vib.connect(vg).connect(o.frequency);
      const h = c.createOscillator(); h.frequency.setValueAtTime(f0 * 2, t0); h.frequency.exponentialRampToValueAtTime(f1 * 2, t0 + d * 0.85);
      const g = c.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.09, t0 + 0.03); g.gain.setValueAtTime(0.09, t0 + d - 0.06); g.gain.linearRampToValueAtTime(0, t0 + d);
      const hg = c.createGain(); hg.gain.value = 0.12;
      o.connect(g); h.connect(hg).connect(g); g.connect(out);
      [o, vib, h].forEach((x) => { x.start(t0); x.stop(t0 + d + 0.05); });
    };
    note(t, 0.13, 690 * pitch, 720 * pitch);
    note(t + 0.2, 0.38, 760 * pitch, 1120 * pitch);
  }

  knock(t, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator(); o.frequency.setValueAtTime(170, t); o.frequency.exponentialRampToValueAtTime(90, t + 0.07);
    const g = c.createGain(); this.env(g, t, { a: 0.001, peak: v * 0.7, d: 0.09 });
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + 0.2);
    const n = this.noiseSrc(t, 0.06, true);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.4;
    const ng = c.createGain(); this.env(ng, t, { a: 0.001, peak: v * 0.9, d: 0.04 });
    n.connect(bp).connect(ng).connect(this.fx);
    this.send(g, { room: 0.6 }); this.send(ng, { room: 0.6 });
  }

  /** Hummed "ooh" through two vowel formants (the shower singer). */
  ooh(t, midi, dur, v = 1, { hall = 0.7, pan = 0 } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(midi);
    const vib = c.createOscillator(); vib.frequency.value = 5.3; const vg = c.createGain(); vg.gain.value = 14;
    vib.connect(vg).connect(o.detune);
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 360; f1.Q.value = 5;
    const f2 = c.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 820; f2.Q.value = 7;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.5, t + 0.06); g.gain.setValueAtTime(v * 0.5, t + dur - 0.06); g.gain.linearRampToValueAtTime(0, t + dur);
    const g2 = c.createGain(); g2.gain.value = 0.5;
    o.connect(f1).connect(g); o.connect(f2).connect(g2).connect(g);
    const pn = this.pan(g, pan); pn.connect(this.airy); this.send(pn, { hall });
    [o, vib].forEach((x) => { x.start(t); x.stop(t + dur + 0.05); });
  }

  squeak(t, v = 1) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = 'triangle';
    o.frequency.setValueAtTime(1500, t); o.frequency.exponentialRampToValueAtTime(2500, t + 0.09);
    const am = c.createOscillator(); am.frequency.value = 85; const amg = c.createGain(); amg.gain.value = 0.5;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.05, t + 0.01); g.gain.linearRampToValueAtTime(0, t + 0.1);
    am.connect(amg).connect(g.gain);
    o.connect(g).connect(this.fx); this.send(g, { room: 0.4 });
    [o, am].forEach((x) => { x.start(t); x.stop(t + 0.12); });
  }

  // ---- groove voices (v3) ------------------------------------------------------
  /** Tabla strokes: na / tin (dayan, tuned to D), ge (bayan with palm bend), dha, ka. */
  tabla(t, stroke, v = 1, { pan = 0, room = 0.25 } = {}) {
    const c = this.ctx;
    const out = c.createGain(); out.gain.value = v;
    const pn = this.pan(out, pan); pn.connect(this.drums); this.send(pn, { room });
    const dayan = (ring) => {
      const f = 587.3;
      [[1, 1, ring], [2.0, 0.5, ring * 0.6], [3.01, 0.32, ring * 0.45], [4.02, 0.18, ring * 0.3], [5.1, 0.1, ring * 0.2]].forEach(([r, a, d]) => {
        const o = c.createOscillator(); o.frequency.value = f * r;
        const g = c.createGain(); this.env(g, t, { a: 0.0008, peak: a * 0.28, d });
        o.connect(g).connect(out); o.start(t); o.stop(t + d + 0.1);
      });
      const n = this.noiseSrc(t, 0.03);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 1.2;
      const ng = c.createGain(); this.env(ng, t, { a: 0.0005, peak: 0.35, d: 0.012 });
      n.connect(bp).connect(ng).connect(out);
    };
    const bayan = (bend = 1) => {
      const o = c.createOscillator();
      o.frequency.setValueAtTime(92, t);
      o.frequency.linearRampToValueAtTime(92 + 55 * bend, t + 0.14);
      o.frequency.setTargetAtTime(92 + 40 * bend, t + 0.14, 0.2);
      const g = c.createGain(); this.env(g, t, { a: 0.002, peak: 0.9, d: 0.55 });
      o.connect(this.shaper(1.6)).connect(g).connect(out); o.start(t); o.stop(t + 0.9);
      const n = this.noiseSrc(t, 0.05, true);
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600;
      const ng = c.createGain(); this.env(ng, t, { a: 0.001, peak: 0.5, d: 0.03 });
      n.connect(lp).connect(ng).connect(out);
    };
    if (stroke === 'na') dayan(0.22);
    else if (stroke === 'tin') dayan(0.55);
    else if (stroke === 'ge') bayan(1);
    else if (stroke === 'dha') { dayan(0.3); bayan(0.8); }
    else if (stroke === 'ka') {
      const n = this.noiseSrc(t, 0.06, true);
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 380; bp.Q.value = 1.6;
      const g = c.createGain(); this.env(g, t, { a: 0.0008, peak: 1.0, d: 0.035 });
      n.connect(bp).connect(g).connect(out);
    }
  }

  /** Formant vocal chop: short sung syllable, pitched, scooped into the note. */
  chop(t, midi, dur, v = 1, { vowel = 'a', pan = 0, delay = 0.18, hall = 0.28, out = this.music } = {}) {
    const c = this.ctx;
    const F = { a: [[730, 1], [1090, 0.5], [2440, 0.25]], o: [[570, 1], [840, 0.45], [2410, 0.2]], u: [[320, 1], [870, 0.3], [2240, 0.12]], e: [[530, 1], [1840, 0.45], [2480, 0.25]], i: [[300, 1], [2290, 0.4], [3010, 0.25]] }[vowel];
    const f0 = 440 * Math.pow(2, (midi - 69) / 12);
    const src = c.createGain();
    for (const [det, typ, lvl] of [[-6, 'sawtooth', 0.6], [6, 'sawtooth', 0.6], [1200, 'triangle', 0.25]]) {
      const o = c.createOscillator(); o.type = typ;
      o.frequency.setValueAtTime(f0 * Math.pow(2, -0.6 / 12), t);
      o.frequency.exponentialRampToValueAtTime(f0, t + 0.035);
      o.detune.value = det;
      const g = c.createGain(); g.gain.value = lvl;
      o.connect(g).connect(src); o.start(t); o.stop(t + dur + 0.08);
    }
    const mix = c.createGain();
    for (const [f, a] of F) {
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = f < 1000 ? 7 : 11;
      const g = c.createGain(); g.gain.value = a * 2.2;
      src.connect(bp).connect(g).connect(mix);
    }
    const air = c.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 5000; air.gain.value = 4;
    const env = c.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(v * 0.34, t + 0.006);
    env.gain.setValueAtTime(v * 0.34, t + Math.max(0.01, dur - 0.035)); env.gain.linearRampToValueAtTime(0, t + dur);
    const pn = this.pan(mix.connect(air).connect(env), pan);
    pn.connect(out);
    this.send(pn, { delay, hall });
  }

  shaker(t, v = 1, pan = 0.3) {
    const c = this.ctx;
    const n = this.noiseSrc(t, 0.09);
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 7800; bp.Q.value = 1.1;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.22, t + 0.012); g.gain.setTargetAtTime(0, t + 0.014, 0.02);
    this.pan(n.connect(bp).connect(g), pan).connect(this.drums);
  }

  /** 808-style sub with a glide into the next note. */
  sub808(t, midi, dur, v = 1, glideTo = null) {
    const c = this.ctx;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * 1.9, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.04);
    if (glideTo !== null) o.frequency.setTargetAtTime(440 * Math.pow(2, (glideTo - 69) / 12), t + dur * 0.55, dur * 0.12);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v * 0.85, t + 0.004);
    g.gain.setTargetAtTime(v * 0.55, t + 0.05, 0.25); g.gain.setTargetAtTime(0, t + dur, 0.06);
    o.connect(this.shaper(2.2)).connect(g).connect(this.music);
    o.start(t); o.stop(t + dur + 0.4);
  }

  /** Resonant-filtered supersaw hit through a rising filter (build sweeps). */
  sweep(t0, t1, notes, v = 1) {
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(300, t0); lp.frequency.exponentialRampToValueAtTime(7000, t1);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(v * 0.05, t1 - 0.02); g.gain.linearRampToValueAtTime(0, t1);
    lp.connect(g).connect(this.fx);
    this.send(g, { hall: 0.3 });
    notes.forEach((m) => [-12, 0, 12].forEach((d) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 440 * Math.pow(2, (m - 69) / 12); o.detune.value = d;
      o.connect(lp); o.start(t0); o.stop(t1 + 0.05);
    }));
  }
}
