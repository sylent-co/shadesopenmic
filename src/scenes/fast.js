// Act 2 (5.5 – 12.0 s): fast kinetic typography at 120 BPM.
// Five relatable lines, each with its own colour scheme, motion signature and
// hand-off transition, then the "GIVE IT A MIC." climax whose red full stop
// becomes the SHADES disc.

import { T, COPY, C, BEAT, EVENT } from '../config.js';
import { clamp, lerp, seg, ease, hash1, mulberry32, TAU, smoothstep, spring, rgba } from '../core/math.js';
import { font } from '../core/fonts.js';
import { layout, metrics, textWidth } from './text.js';
import { brandDiscCanvas } from './logo.js';
import { glowDot } from './intro.js';

const SCHEME = [
  { bg: C.red, fg: C.cream, sub: C.cream, accent: C.ink, hud: C.cream },
  { bg: C.cream, fg: C.ink, sub: C.ink, accent: C.red, hud: C.ink },
  { bg: C.night, fg: C.cream, sub: '#E9E2F2', accent: '#FF4127', hud: C.cream },
  { bg: C.ink, fg: C.cream, sub: C.cream, accent: C.red, hud: C.cream },
  { bg: C.red, fg: C.cream, sub: C.cream, accent: C.ink, hud: C.cream },
];

const IDENT = [1, 0, 0, 1, 0, 0];
function setView(K, m) {
  K.L.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  K.G.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  K.S.setTransform(m[0] * 0.5, m[1] * 0.5, m[2] * 0.5, m[3] * 0.5, m[4] * 0.5, m[5] * 0.5);
}
/** Matrix scaling by s about P while moving P to Q. */
const zoomM = (P, Q, s) => [s, 0, 0, s, Q[0] - s * P[0], Q[1] - s * P[1]];

const beatEnv = (t, decay = 9) => {
  const b = (t - T.drop) / BEAT;
  if (b < 0) return 0;
  return Math.exp(-(b - Math.floor(b)) * BEAT * decay);
};

// ---------------------------------------------------------------------------
// layout

const fitCache = new Map();
/** Size & width-axis value so `word` has cap height capPx and fills targetW. */
function fitKey(ctx, word, targetW, capPx, wght = 900) {
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

function blockLayout(K, word, opt = {}) {
  const { L, W, H } = K;
  const portrait = H > W;
  const U = portrait ? W * 0.9 : H;
  const fit = fitKey(L, word, portrait ? 0.84 * W : (opt.targetW || 0.64) * W, portrait ? 0.16 * H : 0.33 * H);
  const x0 = opt.left !== undefined && !portrait ? opt.left * W : (W - fit.width) / 2;
  const baseline = H * 0.5 + fit.capPx / 2 + 0.015 * H;
  const thatSize = 0.105 * U;
  const tailSize = 0.066 * U;
  return {
    ...fit, x0, baseline, top: baseline - fit.capPx,
    thatSize, tailSize,
    thatBase: baseline - fit.capPx - 0.035 * U, thatX: x0 + 0.004 * W,
    tailBase: baseline + 0.11 * U,
  };
}

/** Split a tail string into tokens; *word* marks an accent, final '.' is accent. */
function tailTokens(text) {
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
function riseTail(K, text, lay, lt, t0, stagger, colors, alignRight = true) {
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

function drawThat(K, lay, lt, t0, color, mode = 'slide') {
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

// ---------------------------------------------------------------------------
// HUD: small editorial labels that carry event info through the fast section

function drawHUD(K, t, idx, color, alpha = 1) {
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

// ---------------------------------------------------------------------------
// 01 POEM — red paper, ruled lines, typed tail with a caret

function scenePoem(K, lt, t) {
  const { L, G, W, H } = K;
  const sc = SCHEME[0];
  const lay0 = blockLayout(K, 'POEM');
  const wd = lerp(125, lay0.wdth, ease.outExpo(clamp((lt - 0.02) / 0.5)));
  const f = font('mona', lay0.size, 900, wd);
  const lw = layout(L, 'POEM', f);
  const x0 = (W - lw.width) / 2;
  // iris from the sun disc
  const r0 = 0.229 * H, rMax = Math.hypot(W, H) / 2 + 10;
  const ir = lerp(r0, rMax, ease.outExpo(clamp(lt / 0.22)));
  L.save();
  L.beginPath();
  L.arc(W / 2, H / 2, ir, 0, TAU);
  L.clip();
  const g = L.createRadialGradient(W * 0.5, H * 0.62, 0, W * 0.5, H * 0.62, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, '#E4301A');
  g.addColorStop(1, '#B51B0B');
  L.fillStyle = g;
  L.fillRect(0, 0, W, H);
  // ruled notebook lines drifting upward + margin line
  const gap = 0.074 * H;
  const off = (lt * 0.06 * H) % gap;
  L.fillStyle = rgba(C.cream, 0.10);
  for (let y = gap * 0.6 - off; y < H; y += gap) L.fillRect(0, y, W, Math.max(1, 0.0016 * H));
  L.fillStyle = rgba(C.cream, 0.16);
  L.fillRect(0.085 * W, 0, Math.max(1, 0.0022 * H), H);
  // key letters rise from the baseline, staggered
  L.font = f;
  L.fillStyle = sc.fg;
  for (const ch of lw.chars) {
    const p = ease.snap(clamp((lt - 0.03 - ch.i * 0.035) / 0.26));
    if (p <= 0) continue;
    L.save();
    L.beginPath();
    L.rect(x0 + ch.x - 10, lay0.baseline - lay0.capPx * 1.25, ch.w + 20, lay0.capPx * 1.3);
    L.clip();
    L.fillText(ch.ch, x0 + ch.x, lay0.baseline + (1 - p) * lay0.capPx * 1.1);
    L.restore();
  }
  const lay = { ...lay0, x0, width: lw.width };
  drawThat(K, lay, lt, 0.08, sc.sub);
  // typed tail + caret
  const tail = COPY.lines[0].tail;
  const ft = font('serifIt', lay.tailSize);
  const full = textWidth(L, tail, ft);
  const tx = lay.x0 + lay.width - full;
  const n = Math.round(tail.length * clamp((lt - 0.26) / 0.36));
  L.font = ft;
  L.fillStyle = sc.sub;
  const shown = tail.slice(0, n);
  const body = shown.endsWith('.') ? shown.slice(0, -1) : shown;
  L.fillText(body, tx, lay.tailBase);
  if (shown.endsWith('.')) { L.fillStyle = sc.accent; L.fillText('.', tx + textWidth(L, body, ft), lay.tailBase); }
  if (lt > 0.24) {
    const cxp = tx + textWidth(L, shown, ft) + lay.tailSize * 0.08;
    const blink = n < tail.length || Math.floor((lt - 0.62) / 0.12) % 2 === 0;
    if (blink) { L.fillStyle = sc.sub; L.fillRect(cxp, lay.tailBase - lay.tailSize * 0.78, Math.max(2, lay.tailSize * 0.06), lay.tailSize * 0.95); }
  }
  L.restore();
  // shock ring at the iris edge
  if (lt < 0.3) {
    G.save();
    G.globalAlpha = (1 - lt / 0.3) * 0.9;
    G.strokeStyle = '#FFD2B8';
    G.lineWidth = (1 - lt / 0.3) * 0.02 * H + 1;
    G.beginPath(); G.arc(W / 2, H / 2, ir, 0, TAU); G.stroke();
    G.restore();
  }
  // zoom target for the exit: inside the left stroke of the O
  const o = lw.chars[1];
  return { zoomP: [x0 + o.x + o.w * 0.15, lay0.baseline - lay0.capPx * 0.5] };
}

// 02 SONG — cream, red vocal waveform, letters drop and pulse like an EQ

const DROPS = Array.from({ length: 34 }, (_, i) => { const r = mulberry32(333 + i); return { x: r(), p: r(), len: 0.05 + r() * 0.08, sp: 1.2 + r() * 0.8 }; });

function sceneSong(K, lt, t) {
  const { L, G, W, H } = K;
  const sc = SCHEME[1];
  L.fillStyle = C.cream;
  L.fillRect(0, 0, W, H);
  const vg = L.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.6);
  vg.addColorStop(0, 'rgba(255,255,255,0)');
  vg.addColorStop(1, 'rgba(120,80,40,0.10)');
  L.fillStyle = vg;
  L.fillRect(0, 0, W, H);
  // shower streaks
  L.strokeStyle = 'rgba(120,140,165,0.28)';
  L.lineWidth = Math.max(1, 0.0022 * H);
  for (const d of DROPS) {
    const y = (((d.p + lt * d.sp) % 1.2) - 0.1) * H;
    L.beginPath(); L.moveTo(d.x * W, y); L.lineTo(d.x * W - 0.004 * H, y + d.len * H); L.stroke();
  }
  // waveform
  const amp = (0.05 + 0.10 * beatEnv(t, 7)) * H * ease.outCubic(clamp(lt / 0.2));
  const drawWave = (color, width, phase, a, k) => {
    L.strokeStyle = color;
    L.lineWidth = width;
    L.beginPath();
    for (let i = 0; i <= 160; i++) {
      const x = (i / 160) * W;
      const u = i / 160;
      const envx = Math.sin(Math.PI * u);
      const y = H * 0.5 + a * envx * (Math.sin(u * k + phase - t * 18) * 0.7 + Math.sin(u * k * 2.3 + phase * 1.7 - t * 27) * 0.3);
      i ? L.lineTo(x, y) : L.moveTo(x, y);
    }
    L.stroke();
  };
  drawWave(rgba(C.ink, 0.12), Math.max(1, 0.002 * H), 1.3, amp * 0.7, 21);
  drawWave(C.red, 0.0065 * H, 0, amp, 17);
  // key letters drop in with a bounce, then breathe in weight
  const lay0 = blockLayout(K, 'SONG');
  const f = font('mona', lay0.size, 900, lay0.wdth);
  const lw = layout(L, 'SONG', f);
  for (const ch of lw.chars) {
    const p = clamp((lt - 0.02 - ch.i * 0.045) / 0.34);
    if (p <= 0) continue;
    const y = lerp(-0.65 * H, 0, ease.outBack(p, 1.9));
    const rot = (1 - ease.outCubic(p)) * (ch.i % 2 ? 0.25 : -0.25);
    const pulse = p >= 1 ? 0.5 + 0.5 * Math.sin(t * TAU * 2 - ch.i * 1.2) : 1;
    const wg = lerp(640, 900, pulse);
    const cx = lay0.x0 + ch.x + ch.w / 2;
    L.save();
    L.translate(cx, lay0.baseline + y);
    L.rotate(rot);
    L.font = font('mona', lay0.size, wg, lay0.wdth);
    L.textAlign = 'center';
    L.fillStyle = sc.fg;
    L.fillText(ch.ch, 0, 0);
    L.restore();
  }
  drawThat(K, lay0, lt, 0.1, sc.sub);
  riseTail(K, COPY.lines[1].tail, lay0, lt, 0.24, 0.0625, sc);
}

// 03 STORY — 2 AM night, dim red clock, letters flicker on like a lamp

const STARS = Array.from({ length: 70 }, (_, i) => { const r = mulberry32(700 + i); return { x: r(), y: r() * 0.8, s: 0.4 + r() * 1.2, ph: r() * TAU }; });
const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abged', 5: 'afgcd', 9: 'abcfgd' };
function sevenSeg(ctx, digit, x, y, h, color) {
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

function sceneStory(K, lt, t) {
  const { L, S, G, W, H } = K;
  const sc = SCHEME[2];
  const g = L.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#04051A');
  g.addColorStop(1, '#131845');
  L.fillStyle = g;
  L.fillRect(0, 0, W, H);
  for (const s of STARS) {
    const a = 0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 5 + s.ph), 2);
    L.globalAlpha = a * 0.8;
    L.fillStyle = '#FFFFFF';
    L.beginPath(); L.arc(s.x * W, s.y * H, s.s * 0.0016 * H + 0.5, 0, TAU); L.fill();
  }
  L.globalAlpha = 1;
  // crescent moon
  const mx = 0.84 * W, my = (H > W ? 0.16 : 0.2) * H, mr = 0.05 * Math.min(W, H);
  G.globalAlpha = 0.5;
  G.drawImage(glowDot(128), mx - mr * 3, my - mr * 3, mr * 6, mr * 6);
  G.globalAlpha = 1;
  L.save();
  L.beginPath(); L.arc(mx, my, mr, 0, TAU); L.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.88, 0, TAU, true); L.fillStyle = '#F6EBD2'; L.fill('evenodd');
  L.restore();
  // clock digits, huge and dim, behind the type
  const dh = Math.min(0.46 * H, 0.34 * W);
  const flip = lt > 0.18;
  const digits = flip ? [0, 2, ':', 0, 0] : [0, 1, ':', 5, 9];
  let dw = 0;
  for (const d of digits) dw += d === ':' ? dh * 0.22 : dh * 0.62;
  let x = (W - dw) / 2;
  const flick = lt > 0.16 && lt < 0.22 && Math.floor(lt * 90) % 2 === 0;
  for (const d of digits) {
    if (d === ':') {
      const on = Math.floor(t * 2) % 2 === 0;
      for (const cy of [0.33, 0.67]) { S.fillStyle = on ? '#FF3A1F' : '#5A1208'; S.beginPath(); S.arc(x + dh * 0.08, (H - dh) / 2 + dh * cy, dh * 0.045, 0, TAU); S.fill(); }
      x += dh * 0.22;
      continue;
    }
    for (const [ctx, col, a] of [[L, '#FF2E17', 0.14], [S, '#FF3A1F', flick ? 0.2 : 0.75]]) {
      ctx.save(); ctx.globalAlpha = a * ease.outCubic(clamp(lt / 0.12)); sevenSeg(ctx, d, x, (H - dh) / 2, dh, col); ctx.restore();
    }
    x += dh * 0.62;
  }
  // key letters flicker on
  const lay = blockLayout(K, 'STORY');
  const f = font('mona', lay.size, 900, lay.wdth);
  const lw = layout(L, 'STORY', f);
  for (const ch of lw.chars) {
    const tOn = 0.02 + hash1(ch.i * 3.1 + 5) * 0.16;
    let on = 0;
    if (lt > tOn + 0.12) on = 1;
    else if (lt > tOn) on = hash1(Math.floor(lt * 60) + ch.i * 13) > 0.45 ? 1 : 0.15;
    if (on <= 0) continue;
    const x1 = lay.x0 + ch.x;
    L.save(); L.font = f; L.globalAlpha = on; L.fillStyle = sc.fg; L.fillText(ch.ch, x1, lay.baseline); L.restore();
    S.save(); S.font = f; S.globalAlpha = on * 0.55; S.fillStyle = '#FFD9A0'; S.fillText(ch.ch, x1, lay.baseline); S.restore();
  }
  drawThat(K, lay, lt, 0.1, sc.sub);
  riseTail(K, 'you only tell at *2 AM*.', lay, lt, 0.24, 0.0625, sc);
}

// 04 JOKE — group-chat bubbles pop in, letters wobble with laughter

const BUBBLES = [
  { text: 'HAHAHAHAHA', side: 0, x: 0.055, y: 0.20, t0: 0.04 },
  { text: "I'M CRYING", side: 1, x: 0.945, y: 0.24, t0: 0.15 },
  { text: 'say it again', side: 0, x: 0.03, y: 0.66, t0: 0.30 },
  { text: 'LMAOOO', side: 1, x: 0.97, y: 0.55, t0: 0.42, red: true },
  { text: '•••', side: 0, x: 0.03, y: 0.78, t0: 0.58 },
]
const BUBBLES_PORTRAIT = [[0.06, 0.25], [0.94, 0.31], [0.06, 0.74], [0.94, 0.79], [0.06, 0.85]];
function bubbleGeom(K, b) {
  const { L, W, H } = K;
  if (H > W) { const i = BUBBLES.indexOf(b); b = { ...b, x: BUBBLES_PORTRAIT[i][0], y: BUBBLES_PORTRAIT[i][1] }; }
  const U = Math.min(H, W * 0.9);
  const size = 0.034 * U;
  const f = font('mona', size, 700, 100);
  const tw = textWidth(L, b.text, f);
  const padX = size * 0.8, padY = size * 0.55;
  const bw = tw + padX * 2, bh = size + padY * 2;
  const ax = b.x * W, ay = b.y * H;
  const bx = b.side ? ax - bw : ax;
  return { f, size, bw, bh, bx, by: ay - bh, ax, ay, padX, padY };
}
function drawBubble(K, b, s, alpha = 1) {
  const { L } = K;
  const g = bubbleGeom(K, b);
  L.save();
  L.globalAlpha = alpha;
  L.translate(g.ax, g.ay);
  L.scale(s, s);
  L.translate(-g.ax, -g.ay);
  L.fillStyle = b.side || b.red ? C.red : '#2C2B31';
  L.beginPath();
  L.roundRect(g.bx, g.by, g.bw, g.bh, g.bh * 0.42);
  L.fill();
  L.beginPath();
  const tx = b.side ? g.ax - g.bh * 0.25 : g.ax + g.bh * 0.25;
  L.moveTo(tx, g.ay - g.bh * 0.3);
  L.quadraticCurveTo(b.side ? g.ax + g.bh * 0.02 : g.ax - g.bh * 0.02, g.ay + g.bh * 0.08, b.side ? g.ax + g.bh * 0.16 : g.ax - g.bh * 0.16, g.ay + g.bh * 0.05);
  L.quadraticCurveTo(b.side ? g.ax - g.bh * 0.15 : g.ax + g.bh * 0.15, g.ay - g.bh * 0.02, b.side ? g.ax - g.bh * 0.55 : g.ax + g.bh * 0.55, g.ay - g.bh * 0.12);
  L.fill();
  L.font = g.f;
  L.fillStyle = C.cream;
  L.textBaseline = 'middle';
  L.fillText(b.text, g.bx + g.padX, g.by + g.bh / 2 + g.size * 0.04);
  L.restore();
  return g;
}

function sceneJoke(K, lt, t) {
  const { L, W, H } = K;
  const sc = SCHEME[3];
  L.fillStyle = C.ink;
  L.fillRect(0, 0, W, H);
  for (const b of BUBBLES) {
    const a = lt - b.t0;
    if (a <= 0) continue;
    if (b.text === '•••') {
      const g = drawBubble(K, b, spring(a, 2.4, 8));
      for (let i = 0; i < 3; i++) {
        const yy = g.by + g.bh / 2 - Math.max(0, Math.sin(t * 12 - i * 1.1)) * g.size * 0.25;
        L.fillStyle = rgba(C.cream, 0.9);
        L.beginPath(); L.arc(g.bx + g.padX + g.size * (0.3 + i * 0.75), yy, g.size * 0.17, 0, TAU); L.fill();
      }
      continue;
    }
    drawBubble(K, b, spring(a, 2.4, 8));
  }
  const lay = blockLayout(K, 'JOKE');
  const f = font('mona', lay.size, 900, lay.wdth);
  const lw = layout(L, 'JOKE', f);
  for (const ch of lw.chars) {
    const a = lt - 0.02 - ch.i * 0.04;
    if (a <= 0) continue;
    const s = spring(a, 2.6, 7.5);
    const laugh = 0.035 * Math.sin(t * 44 + ch.i * 2.1) * smoothstep(0.3, 0.45, lt);
    const rot = (hash1(ch.i + 40) - 0.5) * 0.12 + laugh + (1 - clamp(a / 0.3)) * (ch.i % 2 ? 0.3 : -0.3);
    const cx = lay.x0 + ch.x + ch.w / 2, cy = lay.baseline - lay.capPx / 2;
    L.save();
    L.translate(cx, cy);
    L.rotate(rot);
    L.scale(s, s);
    L.font = f;
    L.textAlign = 'center';
    L.fillStyle = sc.fg;
    L.fillText(ch.ch, 0, lay.capPx / 2);
    L.restore();
  }
  drawThat(K, lay, lt, 0.1, sc.sub);
  riseTail(K, COPY.lines[3].tail, lay, lt, 0.24, 0.0625, sc);
}

// 05 MIX — spinning record with the SHADES label, scratch-stutter type

let vinyl = null;
function vinylCanvas(R) {
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

function sceneMix(K, lt, t, ctxL) {
  const { W, H } = K;
  const L = ctxL;
  const sc = SCHEME[4];
  L.fillStyle = C.red;
  L.fillRect(0, 0, W, H);
  const { R, cx, cy } = mixRecord(K);
  const v = vinylCanvas(Math.round(R));
  const intro = ease.outExpo(clamp(lt / 0.24));
  const rot = lt * 5.5 + (1 - intro) * -2.5;
  L.save();
  L.translate(cx, cy);
  L.rotate(rot);
  L.scale(intro, intro);
  L.drawImage(v.c, -v.R, -v.R);
  L.restore();
  // fixed sheen on the vinyl
  if (intro > 0.01) {
    const cg = L.createConicGradient(-0.6, cx, cy);
    cg.addColorStop(0, 'rgba(255,255,255,0)');
    cg.addColorStop(0.08, 'rgba(255,255,255,0.10)');
    cg.addColorStop(0.16, 'rgba(255,255,255,0)');
    cg.addColorStop(0.5, 'rgba(255,255,255,0)');
    cg.addColorStop(0.58, 'rgba(255,255,255,0.08)');
    cg.addColorStop(0.66, 'rgba(255,255,255,0)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    L.save();
    L.beginPath(); L.arc(cx, cy, R * intro, 0, TAU); L.arc(cx, cy, R * 0.34 * intro, 0, TAU, true); L.clip('evenodd');
    L.fillStyle = cg;
    L.fillRect(cx - R, cy - R, 2 * R, 2 * R);
    L.restore();
  }
  const lay = blockLayout(K, 'MIX', MIX_LAYOUT(K));
  const f = font('mona', lay.size, 900, lay.wdth);
  // scratch: back-and-forth offsets
  const sp = clamp((lt - 0.26) / 0.3);
  const scratch = sp > 0 && sp < 1 ? Math.sin(sp * TAU * 2.5) * (1 - sp) * 0.06 * W : 0;
  const appear = ease.snap(clamp((lt - 0.02) / 0.16));
  if (appear > 0) {
    L.save();
    L.font = f;
    if (Math.abs(scratch) > 1) {
      L.globalAlpha = 0.55 * appear;
      L.fillStyle = '#00E1FF';
      L.fillText('MIX', lay.x0 + scratch * 1.35, lay.baseline);
      L.fillStyle = '#FFFFFF';
      L.fillText('MIX', lay.x0 + scratch * 0.6, lay.baseline);
    }
    L.globalAlpha = appear;
    L.fillStyle = sc.fg;
    L.fillText('MIX', lay.x0 + scratch, lay.baseline + (1 - appear) * 0.08 * H);
    L.restore();
  }
  const kk = { L, S: K.S, G: K.G, W, H };
  drawThat(kk, lay, lt, 0.1, sc.sub);
  riseTail(kk, COPY.lines[4].tail, lay, lt, 0.3, 0.0625, sc);
  return { R, cx, cy };
}

function mixRecord(K) {
  const { W, H } = K;
  if (H > W) return { R: 0.52 * W, cx: W * 0.5, cy: H * 0.82 };
  return { R: 0.6 * H, cx: 0.8 * W, cy: 0.52 * H };
}
const MIX_LAYOUT = (K) => (K.H > K.W ? {} : { left: 0.075, targetW: 0.5 });

// ---------------------------------------------------------------------------
// climax: GIVE IT A MIC.

function climaxLayout(K) {
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

function sceneClimax(K, t, post) {
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

// ---------------------------------------------------------------------------

export function fastImpulses() {
  const list = T.lines.slice(1).map((t0) => [t0, 0.45, 11, 9]);
  list.push([T.climaxWords[0], 0.35, 12, 10], [T.climaxWords[1], 0.35, 12, 10], [T.climaxWords[2], 0.35, 12, 10], [T.climaxWords[3], 1.3, 8, 6]);
  return list;
}

export function drawFast(K, t, post) {
  const { L, W, H } = K;
  if (t >= T.climax) {
    if (t < T.endHit + 0.02) sceneClimax(K, t, post);
    drawHUD(K, t, 5, C.cream);
    return;
  }
  const i = clamp(Math.floor((t - T.drop) / 1.0), 0, 4);
  const lt = t - T.lines[i];
  const ex = seg(lt, 0.86, 1.0);
  const live = K.samples <= 1;
  if (i === 0) {
    const P0 = ex > 0 ? scenePoemZoomPoint(K) : null;
    if (ex > 0) {
      const k = ease.inExpo(clamp(ex / 0.9));
      setView(K, zoomM(P0, [lerp(P0[0], W / 2, k), lerp(P0[1], H / 2, k)], Math.exp(k * Math.log(90))));
    }
    scenePoem(K, lt, t);
    setView(K, IDENT);
  } else if (i === 1) {
    if (ex > 0) {
      L.fillStyle = C.night;
      L.fillRect(0, 0, W, H);
      const sy = ex < 0.6 ? lerp(1, 0.006, ease.inCubic(ex / 0.6)) : 0.006;
      const sx = ex < 0.6 ? 1 + 0.04 * ex : lerp(1.02, 0, ease.inQuart((ex - 0.6) / 0.4));
      setView(K, [sx, 0, 0, sy, W / 2 * (1 - sx), H / 2 * (1 - sy)]);
    }
    sceneSong(K, lt, t);
    if (ex > 0) {
      L.fillStyle = `rgba(255,255,255,${0.85 * ex})`;
      L.fillRect(0, 0, W, H);
      setView(K, IDENT);
      K.G.globalAlpha = Math.sin(Math.PI * ex);
      K.G.fillStyle = '#FFFFFF';
      const lwid = ex < 0.6 ? W : W * (1 - ease.inQuart((ex - 0.6) / 0.4));
      K.G.fillRect(W / 2 - lwid / 2, H / 2 - 2, lwid, 4);
      K.G.globalAlpha = 1;
    }
    setView(K, IDENT);
  } else if (i === 2) {
    if (ex > 0) {
      L.fillStyle = C.ink;
      L.fillRect(0, 0, W, H);
      const k = ease.inCubic(ex);
      setView(K, [1, 0, 0, 1, 0, -k * H * 1.05]);
      if (live) post.dirBlur = [0, 0.09 * Math.sin(Math.PI * ex)];
    }
    sceneStory(K, lt, t);
    setView(K, IDENT);
  } else if (i === 3) {
    sceneJoke(K, lt, t);
    if (lt > 0.8) {
      // the red LMAOOO bubble floods the screen
      const b = BUBBLES[3];
      const g = bubbleGeom(K, b);
      const k = ease.inExpo(seg(lt, 0.8, 0.97));
      const s = 1 + k * 60;
      const cxB = g.bx + g.bw * 0.5, cyB = g.by + g.bh * 0.5;
      setView(K, zoomM([cxB, cyB], [lerp(cxB, W / 2, k), lerp(cyB, H / 2, k)], s));
      drawBubble(K, b, 1);
      setView(K, IDENT);
    }
  } else if (i === 4) {
    if (ex > 0) {
      L.fillStyle = C.ink;
      L.fillRect(0, 0, W, H);
    }
    const muffle = 1 - seg(lt, 0.16, 0.28);
    const rec = mixRecord(K);
    const P = H > W ? [rec.cx - rec.R * 0.62, rec.cy - rec.R * 0.1] : [rec.cx - rec.R * 0.3, rec.cy + rec.R * 0.55];
    if (ex > 0) {
      const k = ease.inExpo(clamp(ex / 0.9));
      setView(K, zoomM(P, [lerp(P[0], W / 2, k), lerp(P[1], H / 2, k)], Math.exp(k * Math.log(40))));
    }
    if (muffle > 0.01) {
      // heard through the neighbour's wall: soft and dim, then the filter opens
      K.S.save(); K.S.globalAlpha = muffle; sceneMix(K, lt, t, K.S); K.S.restore();
      if (muffle < 0.99) { L.save(); L.globalAlpha = 1 - muffle; sceneMix(K, lt, t, L); L.restore(); }
      post.sceneGain = 1;
      post.exposure *= lerp(1, 0.55, muffle);
    } else sceneMix(K, lt, t, L);
    setView(K, IDENT);
  }
  drawHUD(K, t, i, SCHEME[i].hud, ex > 0 && i === 1 ? 1 - ex : 1);
}

function scenePoemZoomPoint(K) {
  const { L, W } = K;
  const lay0 = blockLayout(K, 'POEM');
  const f = font('mona', lay0.size, 900, lay0.wdth);
  const lw = layout(L, 'POEM', f);
  const x0 = (W - lw.width) / 2;
  const o = lw.chars[1];
  return [x0 + o.x + o.w * 0.15, lay0.baseline - lay0.capPx * 0.5];
}
