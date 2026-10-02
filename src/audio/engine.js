// Offline render + mastering (BS.1770 loudness normalisation and a look-ahead
// peak limiter) and WAV encoding.

import { T } from '../config.js';
import { Synth } from './synth.js';
import { score } from './score.js';

export const SAMPLE_RATE = 48000;

export async function renderSoundtrack({ sampleRate = SAMPLE_RATE, targetLufs = -14, ceilingDb = -1.6 } = {}) {
  const len = Math.ceil(T.duration * sampleRate);
  const ctx = new OfflineAudioContext(2, len, sampleRate);
  const s = new Synth(ctx);
  score(s);
  const buf = await ctx.startRendering();
  const report = master(buf, targetLufs, ceilingDb);
  return { buffer: buf, report };
}

function biquad(x, b, a) {
  const y = new Float32Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

/** Integrated loudness (LUFS), BS.1770-4 gating; K-weighting for 48 kHz. */
export function integratedLoudness(chs, sr) {
  if (sr !== 48000) throw new Error('loudness meter expects 48 kHz');
  const k = chs.map((x) => biquad(biquad(x, [1.53512485958697, -2.69169618940638, 1.19839281085285], [1, -1.69065929318241, 0.73248077421585]), [1, -2, 1], [1, -1.99004745483398, 0.99007225036621]));
  const block = Math.floor(0.4 * sr), hop = Math.floor(0.1 * sr);
  const z = [];
  for (let s0 = 0; s0 + block <= k[0].length; s0 += hop) {
    let sum = 0;
    for (const c of k) { let e = 0; for (let i = s0; i < s0 + block; i++) e += c[i] * c[i]; sum += e / block; }
    z.push(sum);
  }
  const lk = (v) => -0.691 + 10 * Math.log10(v + 1e-12);
  const abs = z.filter((v) => lk(v) > -70);
  if (!abs.length) return -70;
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  const rel = lk(mean(abs)) - 10;
  const gated = abs.filter((v) => lk(v) > rel);
  return lk(mean(gated));
}

function limiter(chs, sr, ceiling, { lookahead = 0.003, release = 0.08 } = {}) {
  const n = chs[0].length, la = Math.max(1, Math.floor(lookahead * sr));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let p = 0;
    for (const c of chs) p = Math.max(p, Math.abs(c[i]));
    need[i] = p > ceiling ? ceiling / p : 1;
  }
  // m[k] = min(need[k .. k+la]); g[i] = mean(m[i-la .. i]) <= need[i]
  const m = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    let v = 1;
    const e = Math.min(n - 1, k + la);
    for (let j = k; j <= e; j++) if (need[j] < v) v = need[j];
    m[k] = v;
  }
  const rel = Math.exp(-1 / (release * sr));
  let sum = 0, cur = 1, minGain = 1;
  for (let i = 0; i < n; i++) {
    sum += m[i];
    if (i - la - 1 >= 0) sum -= m[i - la - 1];
    // before index la the window is padded with unity gain
    const cnt = Math.min(i + 1, la + 1);
    const box = (sum + (la + 1 - cnt)) / (la + 1);
    cur = box < cur ? box : box + (cur - box) * rel;
    if (cur < minGain) minGain = cur;
    for (const c of chs) c[i] *= cur;
  }
  return minGain;
}

export function master(buf, targetLufs, ceilingDb) {
  const chs = [buf.getChannelData(0), buf.getChannelData(1)];
  const before = integratedLoudness(chs, buf.sampleRate);
  const gain = Math.pow(10, (targetLufs - before) / 20);
  for (const c of chs) for (let i = 0; i < c.length; i++) c[i] *= gain;
  const ceiling = Math.pow(10, ceilingDb / 20);
  const minGain = limiter(chs, buf.sampleRate, ceiling);
  let peak = 0;
  for (const c of chs) for (let i = 0; i < c.length; i++) peak = Math.max(peak, Math.abs(c[i]));
  const after = integratedLoudness(chs, buf.sampleRate);
  return { lufsBefore: before, gainDb: 20 * Math.log10(gain), maxLimiterReductionDb: -20 * Math.log10(minGain), lufsAfter: after, peakDb: 20 * Math.log10(peak) };
}

/** 24-bit PCM WAV. */
export function encodeWav(buf) {
  const chs = [buf.getChannelData(0), buf.getChannelData(1)];
  const n = chs[0].length, bytes = 3, block = 2 * bytes;
  const out = new ArrayBuffer(44 + n * block);
  const v = new DataView(out);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * block, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * block, true); v.setUint16(32, block, true); v.setUint16(34, 24, true);
  str(36, 'data'); v.setUint32(40, n * block, true);
  let o = 44;
  for (let i = 0; i < n; i++) {
    for (const c of chs) {
      const s = Math.max(-1, Math.min(1, c[i]));
      const x = Math.round(s < 0 ? s * 8388608 : s * 8388607);
      v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255);
      o += 3;
    }
  }
  return out;
}
