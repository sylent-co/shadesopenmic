// Shared kit for the kinetic-type section: view transforms, word fitting,
// tails, HUD, seven-segment digits, vinyl and the climax.

import { T, COPY, C, BEAT, EVENT } from '../config.js';
import { clamp, lerp, seg, ease, hash1, mulberry32, TAU } from '../core/math.js';
import { font } from '../core/fonts.js';
import { metrics, textWidth } from './text.js';
import { brandDiscCanvas } from './logo.js';
import { glowDot } from './fx.js';

export const IDENT = [1, 0, 0, 1, 0, 0];
export function setView(K, m) {
  K.L.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  K.G.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  K.S.setTransform(m[0] * 0.5, m[1] * 0.5, m[2] * 0.5, m[3] * 0.5, m[4] * 0.5, m[5] * 0.5);
}
/** Matrix scaling by s about P while moving P to Q. */
export const zoomM = (P, Q, s) => [s, 0, 0, s, Q[0] - s * P[0], Q[1] - s * P[1]];

export const beatEnv = (t, decay = 9) => {
  const b = (t - T.drop) / BEAT;
  if (b < 0) return 0;
  return Math.exp(-(b - Math.floor(b)) * BEAT * decay);
};


export const fitCache = new Map();
/** Size & width-axis value so `word` has cap height capPx and fills targetW. */
export function fitKey(ctx, word, targetW, capPx, wght = 900) {
  const key = `${word}|${Math.round(targetW)}|${Math.round(capPx)}|${wght}`;
  if (fitCache.has(key)) return fitCache.get(key);
  const cap = metrics(ctx, 'mona', wght, 100).cap;
  let size = capPx / cap;
  const wAt = (wd) => textWidth(ctx, word, font('mona', size, wght, wd));
  let wdth;
  if (wAt(125) <= targetW) wdth = 125;
  else if (wAt(75) >= targetW) { wdth = 75; size *= targetW / wAt(75); }
  else {
    let lo = 75, hi = 125;
    for (let i = 0; i < 9; i++) { const mid = (lo + hi) / 2; if (wAt(mid) > targetW) hi = mid; else lo = mid; }
    wdth = lo;
  }
  const r = { size, wdth, width: wAt(wdth), capPx: cap * size };
  fitCache.set(key, r);
  return r;
}


/** Split a tail string into tokens; *word* marks an accent, final '.' is accent. */
export function tailTokens(text) {
  const out = [];
  const re = /\*([^*]+)\*|([^\s*.]+)|(\.)|(\s+)/g;
  let m;
  while ((m = re.exec(text))) {
    if (m[1]) out.push({ text: m[1], accent: true });
    else if (m[2]) out.push({ text: m[2], accent: false });
    else if (m[3]) out.push({ text: '.', accent: true, dot: true });
    else out.push({ text: ' ', space: true });
  }
  return out;
}

/** Words rise from behind a mask, staggered (x: left, or right edge if alignRight). */
export function riseTail(K, text, lay, lt, t0, stagger, colors, alignRight = true) {
  const { L } = K;
  const f = font('serifIt', lay.tailSize);
  const toks = tailTokens(text);
  const full = toks.map((k) => k.text).join('');
  const total = textWidth(L, full, f);
  const x0 = alignRight ? lay.x0 + lay.width - total : lay.x0;
  let prefix = '';
  let wi = 0;
  const clipH = lay.tailSize * 1.25;
  for (const tk of toks) {
    const x = x0 + textWidth(L, prefix, f);
    prefix += tk.text;
    if (tk.space) continue;
    const p = ease.snap(clamp((lt - t0 - wi * stagger) / 0.22));
    wi++;
    if (p <= 0) continue;
    L.save();
    L.beginPath();
    L.rect(x - lay.tailSize * 0.3, lay.tailBase - clipH, textWidth(L, tk.text, f) + lay.tailSize * 0.6, clipH * 1.35);
    L.clip();
    L.font = f;
    L.fillStyle = tk.accent ? colors.accent : colors.sub;
    L.fillText(tk.text, x, lay.tailBase + (1 - p) * clipH);
    L.restore();
  }
  return { x0, total };
}

export function drawThat(K, lay, lt, t0, color, mode = 'slide') {
  const { L } = K;
  const p = ease.snap(clamp((lt - t0) / 0.2));
  if (p <= 0) return;
  const f = font('serifIt', lay.thatSize);
  const w = textWidth(L, 'that', f);
  L.save();
  L.beginPath();
  L.rect(lay.thatX - lay.thatSize * 0.3, lay.thatBase - lay.thatSize * 1.1, w + lay.thatSize * 0.6, lay.thatSize * 1.45);
  L.clip();
  L.font = f;
  L.fillStyle = color;
  L.fillText('that', lay.thatX - (1 - p) * (w + lay.thatSize * 0.5), lay.thatBase);
  L.restore();
}


export function drawHUD(K, t, idx, color, alpha = 1) {
  const { L, W, H } = K;
  const on = seg(t, T.drop + 0.04, T.drop + 0.3, ease.outCubic) * (1 - seg(t, T.endHit - 0.3, T.endHit - 0.12));
  if (on <= 0) return;
  const size = 0.0195 * Math.min(H, W * 0.9);
  const m = 0.052 * Math.min(H, W);
  L.save();
  L.font = font('mono', size, 560);
  L.letterSpacing = `${(size * 0.16).toFixed(1)}px`;
  L.fillStyle = color;
  L.globalAlpha = on * 0.82 * alpha;
  const typed = (s, k) => s.slice(0, Math.round(s.length * clamp(k)));
  const k = seg(t, T.drop + 0.04, T.drop + 0.4);
  L.textBaseline = 'top';
  L.textAlign = 'left';
  L.fillText(typed(`${EVENT.host} — ${EVENT.title}`, k), m, m);
  L.textAlign = 'right';
  L.fillText(typed(`${EVENT.day} ${EVENT.dateShort}`, k), W - m, m);
  L.textBaseline = 'alphabetic';
  L.fillText(typed(`${EVENT.venue.toUpperCase()} · ${EVENT.city.toUpperCase()}`, k), W - m, H - m);
  L.textAlign = 'left';
  const labels = COPY.lines.map((l, i) => `0${i + 1}/05  ${l.label.toUpperCase()}`);
  const lab = idx < 5 ? labels[idx] : '05/05  ALL OF YOU';
  const roll = idx < 5 ? seg(t, T.lines[idx], T.lines[idx] + 0.12, ease.outCubic) : 1;
  L.save();
  L.beginPath();
  L.rect(m - 4, H - m - size * 1.2, W * 0.5, size * 1.5);
  L.clip();
  L.fillText(lab, m, H - m + (1 - roll) * size * 1.4);
  if (roll < 1 && idx > 0) L.fillText(labels[idx - 1], m, H - m - roll * size * 1.4);
  L.restore();
  // progress hairline
  const prog = clamp((t - T.drop) / (T.endHit - T.drop));
  L.globalAlpha = on * 0.35 * alpha;
  L.fillRect(m, H - m * 0.62, (W - 2 * m) * prog, Math.max(1, size * 0.08));
  L.restore();
}


export const STARS = Array.from({ length: 70 }, (_, i) => { const r = mulberry32(700 + i); return { x: r(), y: r() * 0.8, s: 0.4 + r() * 1.2, ph: r() * TAU }; });
export const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 5: 'afgcd', 9: 'abcfgd' };
export function sevenSeg(ctx, digit, x, y, h, color) {
  const w = h * 0.52, th = h * 0.1, s = SEG[digit] || '';
  const segs = {
    a: [x + th * 0.6, y, w - th * 1.2, th], d: [x + th * 0.6, y + h - th, w - th * 1.2, th], g: [x + th * 0.6, y + h / 2 - th / 2, w - th * 1.2, th],
    f: [x, y + th * 0.6, th, h / 2 - th * 0.9], b: [x + w - th, y + th * 0.6, th, h / 2 - th * 0.9],
    e: [x, y + h / 2 + th * 0.3, th, h / 2 - th * 0.9], c: [x + w - th, y + h / 2 + th * 0.3, th, h / 2 - th * 0.9],
  };
  ctx.fillStyle = color;
  for (const k of s) { const r = segs[k]; ctx.beginPath(); ctx.roundRect(r[0], r[1], r[2], r[3], th * 0.4); ctx.fill(); }
  return w;
}


let vinyl = null;
export function vinylCanvas(R) {
  if (vinyl && vinyl.R === R) return vinyl;
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(R * 2);
  const x = c.getContext('2d');
  x.translate(R, R);
  x.fillStyle = '#0B0A0B';
  x.beginPath(); x.arc(0, 0, R, 0, TAU); x.fill();
  const r = mulberry32(99);
  for (let rr = R * 0.36; rr < R * 0.985; rr += Math.max(1.2, R * 0.0045)) {
    x.strokeStyle = `rgba(255,255,255,${0.018 + r() * 0.045})`;
    x.lineWidth = 1;
    x.beginPath(); x.arc(0, 0, rr, 0, TAU); x.stroke();
  }
  x.strokeStyle = 'rgba(255,255,255,0.12)';
  x.lineWidth = R * 0.006;
  for (const rr of [0.52, 0.68, 0.84]) { x.beginPath(); x.arc(0, 0, R * rr, 0, TAU); x.stroke(); }
  const lab = brandDiscCanvas(512, true);
  x.drawImage(lab, -R * 0.34, -R * 0.34, R * 0.68, R * 0.68);
  x.fillStyle = '#0B0A0B';
  x.beginPath(); x.arc(0, 0, R * 0.018, 0, TAU); x.fill();
  vinyl = { c, R };
  return vinyl;
}


export function climaxLayout(K) {
  const { L, W, H } = K;
  const portrait = H > W;
  const row1 = fitKey(L, 'GIVE IT A', portrait ? 0.84 * W : 0.62 * W, portrait ? 0.07 * H : 0.13 * H);
  const row2 = fitKey(L, 'MIC', portrait ? 0.70 * W : 0.52 * W, portrait ? 0.2 * H : 0.40 * H);
  const dotR = row2.capPx * 0.13;
  const gapDot = row2.capPx * 0.07;
  const total2 = row2.width + gapDot + dotR * 2;
  const x2 = (W - total2) / 2;
  const base2 = H * 0.5 + row2.capPx * 0.62;
  const base1 = base2 - row2.capPx - 0.075 * H;
  const x1 = (W - row1.width) / 2;
  return { row1, row2, x1, x2, base1, base2, dot: [x2 + row2.width + gapDot + dotR, base2 - dotR], dotR };
}

export function sceneClimax(K, t, post) {
  const { L, S, G, W, H } = K;
  L.fillStyle = C.ink;
  L.fillRect(0, 0, W, H);
  const lay = climaxLayout(K);
  const [w1, w2, w3, w4] = T.climaxWords;
  const zoom = seg(t, T.endHit - 0.26, T.endHit, ease.inExpo);
  const hold = seg(t, w4, T.endHit - 0.26, ease.linear);
  // camera: slow push toward the dot, then fly into it
  const targetR = 0.24 * H;
  const sHold = 1 + 0.05 * hold;
  const sZoom = Math.exp(lerp(Math.log(sHold), Math.log(targetR / lay.dotR), zoom));
  const P = lay.dot;
  const Q = [lerp(P[0], W / 2, zoom), lerp(P[1], H / 2, zoom)];
  setView(K, zoomM(P, Q, sZoom));
  // rays behind the dot
  if (t > w4) {
    const a = clamp((t - w4) / 0.3) * (1 - zoom);
    G.save();
    G.translate(P[0], P[1]);
    G.rotate(t * 0.25);
    for (let i = 0; i < 18; i++) {
      G.rotate(TAU / 18);
      G.globalAlpha = a * (0.05 + 0.05 * hash1(i));
      G.fillStyle = '#FF5A3A';
      G.beginPath(); G.moveTo(0, 0); G.lineTo(H * 1.4, -H * 0.045); G.lineTo(H * 1.4, H * 0.045); G.fill();
    }
    G.restore();
  }
  // row 1 words
  const f1 = font('mona', lay.row1.size, 900, lay.row1.wdth);
  const words = ['GIVE', 'IT', 'A'];
  const times = [w1, w2, w3];
  let prefix = '';
  const push = ease.outExpo(clamp((t - w4) / 0.16));
  const base1 = lerp(H * 0.5 + lay.row1.capPx / 2, lay.base1, push);
  words.forEach((wd, i) => {
    const x = lay.x1 + textWidth(L, prefix, f1);
    prefix += wd + ' ';
    const a = t - times[i];
    if (a < 0) return;
    const p = ease.outExpo(clamp(a / 0.14));
    const s = lerp(1.7, 1, p);
    const w = textWidth(L, wd, f1);
    L.save();
    L.translate(x + w / 2, base1 - lay.row1.capPx / 2);
    L.scale(s, s);
    L.globalAlpha = clamp(a / 0.03);
    L.font = f1;
    L.fillStyle = C.cream;
    L.fillText(wd, -w / 2, lay.row1.capPx / 2);
    L.restore();
  });
  // MIC + red dot
  const a4 = t - w4;
  if (a4 >= 0) {
    const p = ease.outExpo(clamp(a4 / 0.2));
    const s = lerp(2.6, 1, p);
    const f2 = font('mona', lay.row2.size, 900, lay.row2.wdth);
    const cx = W / 2, cy = lay.base2 - lay.row2.capPx / 2;
    L.save();
    L.translate(cx, cy);
    L.scale(s, s);
    L.translate(-cx, -cy);
    L.globalAlpha = clamp(a4 / 0.03) * (1 - zoom * 0.9);
    L.font = f2;
    L.fillStyle = C.cream;
    L.fillText('MIC', lay.x2, lay.base2);
    L.restore();
    const pulse = 1 + 0.06 * beatEnv(t, 10);
    const dotS = lerp(3.5, 1, ease.outExpo(clamp((a4 - 0.04) / 0.22)));
    const r = lay.dotR * dotS * pulse;
    const disc = brandDiscCanvas(512, false);
    L.drawImage(disc, P[0] - r, P[1] - r, 2 * r, 2 * r);
    G.globalAlpha = 0.35 * (1 - zoom);
    G.drawImage(glowDot(128), P[0] - r * 3, P[1] - r * 3, r * 6, r * 6);
    G.globalAlpha = 1;
    // shockwave ring
    if (a4 < 0.5) {
      G.save();
      G.globalAlpha = (1 - a4 / 0.5) * 0.8;
      G.strokeStyle = '#FFB09A';
      G.lineWidth = (1 - a4 / 0.5) * 0.02 * H + 1;
      G.beginPath(); G.arc(P[0], P[1], lay.dotR + a4 * 2.4 * H, 0, TAU); G.stroke();
      G.restore();
    }
    if (a4 < 0.25) { post.flash += Math.exp(-a4 * 28) * 0.8; post.flashColor = [1, 0.9, 0.85]; }
  }
  setView(K, IDENT);
}


/**
 * Key-word layout. mode 'left' puts the block on the left (a prop sits on the
 * right); 'center' centres it. Portrait always stacks the block at the top.
 */
export function keyLayout(K, word, mode = 'left', opt = {}) {
  const { L, W, H } = K;
  const portrait = H > W;
  const U = portrait ? W * 0.9 : H;
  let targetW, cap;
  if (portrait) { targetW = (opt.pTargetW ?? 0.84) * W; cap = opt.pCap ?? 0.105 * H; }
  else if (mode === 'left') { targetW = (opt.targetW ?? 0.47) * W; cap = opt.cap ?? 0.27 * H; }
  else { targetW = (opt.targetW ?? 0.62) * W; cap = opt.cap ?? 0.30 * H; }
  const fit = fitKey(L, word, targetW, cap);
  let x0, baseline;
  if (portrait) { x0 = (W - fit.width) / 2; baseline = (opt.pY ?? 0.25) * H + fit.capPx / 2; }
  else if (mode === 'left') { x0 = (opt.left ?? 0.07) * W; baseline = (opt.cy ?? 0.5) * H + fit.capPx / 2; }
  else { x0 = opt.cx !== undefined ? opt.cx - fit.width / 2 : (W - fit.width) / 2; baseline = (opt.cy ?? 0.5) * H + fit.capPx / 2 + 0.015 * H; }
  const thatSize = (opt.thatK ?? 0.092) * U, tailSize = (opt.tailK ?? 0.062) * U;
  return {
    ...fit, x0, baseline, top: baseline - fit.capPx, thatSize, tailSize, U,
    thatBase: baseline - fit.capPx - 0.035 * U, thatX: x0 + 0.004 * W, tailBase: baseline + 0.105 * U,
    alignRight: !(mode === 'left' && !portrait),
  };
}
