// Act 3 (26.4 – 36.5 s): the full stop becomes the SHADES disc, a red moon over
// the night river. The event details then arrive one idea at a time —
// presenter, title, who it's for, when, where — before a clean final lockup.

import { T, EVENT, C } from '../config.js';
import { clamp, lerp, seg, ease, smoothstep, TAU } from '../core/math.js';
import { font } from '../core/fonts.js';
import { layout, metrics, textWidth } from './text.js';
import { cameraBasis, dirFromAngles, projectDir } from './camera.js';
import { SOFT_MAX, glowDot } from './fx.js';
import BCB_PATH from './boatclubPath.js';

let bcbPath = null;

const SUN_EL = 0.49;
const SUN_RAD = 0.1;
// End cards are authored on the design timeline; the director warps real time onto it.
const E = T.endDesign;

// camera keyframes: [pitch, tanHalf]
const KF = {
  hit: [SUN_EL, SUN_RAD / 0.48],
  logo: [SUN_EL - 0.0875, SUN_RAD / 0.32],
  cards: [0.083, 0.26],
  lock: [0.137, SUN_RAD / 0.17],
};
const mixKF = (a, b, k) => [lerp(a[0], b[0], k), Math.exp(lerp(Math.log(a[1]), Math.log(b[1]), k))];

export function endCamera(t) {
  let kf = mixKF(KF.hit, KF.logo, seg(t, E[0] + 0.05, E[0] + 0.7, ease.inOutCubic));
  kf = mixKF(kf, KF.cards, seg(t, E[1] - 0.15, E[1] + 0.35, ease.inOutCubic));
  kf = mixKF(kf, KF.lock, seg(t, E[5] - 0.15, E[5] + 0.45, ease.inOutCubic));
  const drift = 0.004 * Math.sin(t * 0.7);
  const basis = cameraBasis(0, kf[0] + drift, 0);
  return { ...basis, pos: [0, 1.0 + 0.004 * Math.sin(t * 0.9), 0.02 * t], tanHalf: kf[1] };
}

export function endScene(t, cam) {
  return {
    uTime: t, uCamPos: cam.pos, uCamF: cam.f, uCamR: cam.r, uCamU: cam.u, uTanHalf: cam.tanHalf,
    uSunDir: dirFromAngles(0, SUN_EL), uSunRad: SUN_RAD, uNight: 1, uWind: 0.1,
    uFocus: 1 - seg(t, E[0] - 0.05, E[0] + 0.6, ease.inOutQuad),
    uBrand: 1, uMark: 1, uMarkSweep: lerp(-0.1, 1.15, seg(t, E[0] + 0.03, E[0] + 0.45, ease.inOutCubic)),
    uCalm: 1, uExposure: 1, uSunVis: 1,
  };
}

// ---- text helpers ---------------------------------------------------------------

/** Letters rise out of a mask; `out` (0..1) lifts and blurs them away. */
function riseLine(K, text, f, cx, base, capPx, t0, t, { stagger = 0.02, color = C.cream, alpha = 1, tracking = 0, out = 0 } = {}) {
  const { L, S } = K;
  const lw = layout(L, text, f, tracking);
  const x0 = cx - lw.width / 2;
  for (const ch of lw.chars) {
    const p = ease.snap(clamp((t - t0 - ch.i * stagger) / 0.34));
    if (p <= 0 || ch.ch === ' ') continue;
    const o = ease.inCubic(clamp(out * 1.3 - (ch.i / lw.chars.length) * 0.3));
    const blur = o * 16;
    const k = clamp(blur / SOFT_MAX);
    const y = base + (1 - p) * capPx * 1.25 - o * capPx * 0.5;
    for (const [ctx, a] of [[L, (1 - k)], [S, k]]) {
      if (a * alpha * (1 - o) < 0.01) continue;
      ctx.save();
      if (ctx === L && p < 1) { ctx.beginPath(); ctx.rect(x0 + ch.x - capPx * 0.3, base - capPx * 1.35, ch.w + capPx * 0.6, capPx * 1.7); ctx.clip(); }
      ctx.font = f; ctx.globalAlpha = a * alpha * (1 - o); ctx.fillStyle = color;
      ctx.fillText(ch.ch, x0 + ch.x, y);
      ctx.restore();
    }
  }
  return lw.width;
}

const outK = (t, tEnd) => seg(t, tEnd - 0.18, tEnd, ease.inQuad);
const cap = (K, key, w = 900, wd = 100) => metrics(K.L, key, w, wd).cap;

/** Largest size (<= capPx) for which `text` fits within maxW. */
function fitCap(K, text, key, wght, wdth, capPx, maxW, tracking = 0) {
  const c = cap(K, key, wght, wdth);
  let size = capPx / c;
  const w = textWidth(K.L, text, font(key, size, wght, wdth), tracking * size);
  if (w > maxW) size *= maxW / w;
  return size;
}

// ---- cards ------------------------------------------------------------------------

function cardLogo(K, t, discY, discR) {
  const { W, H } = K;
  const U = Math.min(H, W * 0.9);
  const out = outK(t, E[1]);
  const size = fitCap(K, EVENT.host, 'mona', 900, 125, 0.075 * U, 0.7 * W, 0.2);
  const base = discY + discR + 0.16 * U;
  riseLine(K, EVENT.host, font('mona', size, 900, 125), W / 2, base, size * cap(K, 'mona', 900, 125), E[0] + 0.55, t, { tracking: size * 0.2, stagger: 0.035, out, color: '#FFF7EE' });
  const ps = 0.06 * U;
  riseLine(K, 'presents', font('serifIt', ps), W / 2, base + 0.085 * U, ps * 0.7, E[0] + 0.8, t, { stagger: 0.02, out, color: '#F0D9C6' });
}

function cardTitle(K, t) {
  const { W, H } = K;
  const U = Math.min(H, W * 0.9);
  const out = outK(t, E[2]);
  const wd = lerp(125, 112, ease.outExpo(clamp((t - E[1] - 0.1) / 0.7)));
  const size = fitCap(K, EVENT.title, 'mona', 900, wd, 0.2 * U, 0.86 * W);
  const c = size * cap(K, 'mona', 900, wd);
  riseLine(K, EVENT.title, font('mona', size, 900, wd), W / 2, 0.47 * H + c / 2, c, E[1] + 0.08, t, { stagger: 0.03, out, color: '#FFF7EE' });
  const rp = ease.inOutCubic(clamp((t - E[1] - 0.45) / 0.45)) * (1 - out);
  if (rp > 0) { K.L.fillStyle = '#FF3A1F'; const rw = 0.2 * W * rp; K.L.fillRect(W / 2 - rw / 2, 0.47 * H + c / 2 + 0.05 * U, rw, Math.max(2, 0.004 * U)); }
}

function cardRoles(K, t) {
  const { W, H } = K;
  const U = Math.min(H, W * 0.9);
  const out = outK(t, E[3]);
  const ls = 0.055 * U;
  riseLine(K, 'an evening for', font('serifIt', ls), W / 2, 0.21 * H, ls * 0.7, E[2] + 0.05, t, { out, color: '#F0D9C6' });
  const roles = EVENT.roles.map((r) => (r === 'DJs' ? 'DJs' : r.toUpperCase()));
  const c = 0.05 * U;
  const size = Math.min(...roles.map((r) => fitCap(K, r, 'mona', 820, 112, c, 0.8 * W, 0.08)));
  const cc = size * cap(K, 'mona', 820, 112);
  const step = (0.78 * H - 0.32 * H) / (roles.length - 1);
  roles.forEach((r, k) => {
    const t0 = E[2] + 0.22 + k * 0.15;
    const hot = Math.exp(-Math.max(0, t - t0 - 0.05) * 5);
    riseLine(K, r, font('mona', size, 820, 112), W / 2, 0.32 * H + k * step + cc / 2, cc, t0, t, { tracking: size * 0.08, stagger: 0.012, out, color: hot > 0.05 ? lerpColor(hot) : '#FFF7EE' });
  });
}
const lerpColor = (k) => `rgb(255,${Math.round(247 - 170 * k)},${Math.round(238 - 200 * k)})`;

function cardDate(K, t) {
  const { L, W, H } = K;
  const U = Math.min(H, W * 0.9);
  const out = outK(t, E[4]);
  const ds = 0.04 * U;
  riseLine(K, EVENT.dayLong, font('mona', ds, 700, 125), W / 2, 0.25 * H, ds * 0.72, E[3] + 0.05, t, { tracking: ds * 0.45, stagger: 0.015, out, color: '#F0D9C6' });
  // "24 OCT": the digits roll into place like an odometer
  const text = '24 OCT';
  const size = fitCap(K, text, 'mona', 900, 112, 0.22 * U, 0.8 * W);
  const f = font('mona', size, 900, 112);
  const c = size * cap(K, 'mona', 900, 112);
  const base = 0.47 * H + c / 2;
  const lw = layout(L, text, f);
  const x0 = W / 2 - lw.width / 2;
  const o = ease.inCubic(out);
  L.save(); L.beginPath(); L.rect(0, base - c * 1.25, W, c * 1.5); L.clip();
  L.font = f; L.fillStyle = '#FFF7EE'; L.globalAlpha = 1 - o;
  for (const ch of lw.chars) {
    if (ch.ch === ' ') continue;
    const p = ease.outCubic(clamp((t - E[3] - 0.12 - ch.i * 0.07) / 0.5));
    if (p <= 0) continue;
    const isDigit = /\d/.test(ch.ch);
    const spins = isDigit ? 4 + ch.i : 1;
    const roll = (1 - p) * spins;
    const k = Math.floor(roll);
    const frac = roll - k;
    const glyph = (n) => (n === 0 ? ch.ch : isDigit ? String((Number(ch.ch) + n * 3) % 10) : ch.ch);
    for (const [n, dy] of [[k, frac], [k + 1, frac - 1]]) {
      if (!isDigit && n > 0) continue;
      L.fillText(glyph(n), x0 + ch.x, base - dy * c * 1.3 - o * c * 0.4);
    }
  }
  L.restore();
  const ys = 0.055 * U;
  riseLine(K, '2026', font('mona', ys, 600, 110), W / 2, base + 0.1 * U, ys * 0.72, E[3] + 0.5, t, { tracking: ys * 0.3, out, color: '#F0D9C6' });
}

function cardVenue(K, t) {
  const { L, G, W, H } = K;
  const U = Math.min(H, W * 0.9);
  const out = outK(t, E[5]);
  const vs = fitCap(K, EVENT.venue, 'serifIt', 400, 100, 0.1 * U, 0.84 * W);
  const vc = vs * cap(K, 'serifIt', 400, 100);
  const base = 0.44 * H + vc / 2;
  riseLine(K, EVENT.venue, font('serifIt', vs), W / 2, base, vc, E[4] + 0.06, t, { stagger: 0.02, out, color: '#FFF7EE' });
  // the venue's own emblem, in their tan
  const ep = ease.outBack(clamp((t - E[4] - 0.02) / 0.4), 1.6) * (1 - ease.inCubic(out));
  if (ep > 0) {
    bcbPath ||= new Path2D(BCB_PATH);
    const er = 0.075 * U;
    L.save(); L.translate(W / 2, base - vc - 0.05 * U - er); L.scale(er * ep, er * ep); L.rotate((1 - ep) * -0.6);
    L.globalAlpha = Math.min(1, ep); L.fillStyle = '#DDB788'; L.fill(bcbPath, 'evenodd'); L.restore();
  }
  const cs = 0.045 * U;
  riseLine(K, EVENT.city.toUpperCase(), font('mona', cs, 760, 125), W / 2, base + 0.12 * U, cs * 0.72, E[4] + 0.4, t, { tracking: cs * 0.55, stagger: 0.03, out, color: '#F0D9C6' });
  // the river (the Ganga canal) drawn as a line, ending in a pin
  const p = ease.inOutCubic(clamp((t - E[4] - 0.3) / 0.8)) * (1 - ease.inCubic(out));
  if (p > 0) {
    const y = base + 0.2 * U, x0 = W * 0.28, x1 = W * 0.72;
    L.save(); L.strokeStyle = 'rgba(244,237,224,0.6)'; L.lineWidth = Math.max(1.5, 0.003 * U); L.lineCap = 'round';
    L.beginPath();
    const n = 60;
    for (let i = 0; i <= n * p; i++) {
      const u = i / n;
      const x = lerp(x0, x1, u), yy = y + Math.sin(u * TAU * 1.5) * 0.012 * U;
      i ? L.lineTo(x, yy) : L.moveTo(x, yy);
    }
    L.stroke(); L.restore();
    if (p > 0.98) {
      const pulse = 0.5 + 0.5 * Math.sin((t - E[4]) * 8);
      const px = x1, py = y + Math.sin(TAU * 1.5) * 0.012 * U;
      L.fillStyle = '#FF3A1F'; L.beginPath(); L.arc(px, py, 0.009 * U, 0, TAU); L.fill();
      G.globalAlpha = 0.5 * pulse; G.drawImage(glowDot(64, [255, 80, 50]), px - 0.04 * U, py - 0.04 * U, 0.08 * U, 0.08 * U); G.globalAlpha = 1;
    }
  }
}

function cardLockup(K, t) {
  const { L, W, H } = K;
  const U = Math.min(H, W * 0.9);
  const t0 = E[5] + 0.08;
  const ps = 0.026 * U;
  riseLine(K, `${EVENT.host}  PRESENTS`, font('mona', ps, 640, 118), W / 2, 0.39 * H, ps * 0.72, t0, t, { tracking: ps * 0.5, stagger: 0.012, color: '#F0D9C6' });
  const size = fitCap(K, EVENT.title, 'mona', 900, 112, 0.125 * U, 0.8 * W);
  const c = size * cap(K, 'mona', 900, 112);
  const tb = 0.43 * H + c + 0.02 * U;
  riseLine(K, EVENT.title, font('mona', size, 900, 112), W / 2, tb, c, t0 + 0.12, t, { stagger: 0.03, color: '#FFF7EE' });
  const rp = ease.inOutCubic(clamp((t - t0 - 0.45) / 0.45));
  if (rp > 0) { L.fillStyle = '#FF3A1F'; const rw = 0.12 * W * rp; L.fillRect(W / 2 - rw / 2, tb + 0.045 * U, rw, Math.max(2, 0.0035 * U)); }
  const ds = 0.032 * U;
  const line = `${EVENT.day} ${EVENT.date}  ·  ${EVENT.venue.toUpperCase()}, ${EVENT.city.toUpperCase()}`;
  const dsz = fitCap(K, line, 'mona', 640, 104, ds * 0.72, 0.88 * W, 0.12) ;
  riseLine(K, line, font('mona', dsz, 640, 104), W / 2, tb + 0.12 * U, dsz * 0.72, t0 + 0.55, t, { tracking: dsz * 0.12, stagger: 0.006, color: '#FFF7EE' });
}

export function drawEnd(K, t, cam) {
  const { G, W, H } = K;
  if (t < E[0]) return;
  const sp = projectDir(cam, dirFromAngles(0, SUN_EL), W, H);
  const discR = (SUN_RAD / (2 * cam.tanHalf)) * H;
  if (sp) {
    // seat the disc in the night with a faint red halo
    G.globalAlpha = 0.07 * smoothstep(E[0], E[0] + 0.6, t);
    const g = G.createRadialGradient(sp.x, sp.y, discR * 0.9, sp.x, sp.y, discR * 3.2);
    g.addColorStop(0, 'rgba(255,60,30,0.9)'); g.addColorStop(1, 'rgba(255,40,20,0)');
    G.fillStyle = g; G.fillRect(sp.x - discR * 3.3, sp.y - discR * 3.3, discR * 6.6, discR * 6.6);
    G.globalAlpha = 1;
  }
  if (t < E[1] + 0.02) cardLogo(K, t, sp ? sp.y : H * 0.36, discR);
  else if (t < E[2] + 0.02) cardTitle(K, t);
  else if (t < E[3] + 0.02) cardRoles(K, t);
  else if (t < E[4] + 0.02) cardDate(K, t);
  else if (t < E[5] + 0.02) cardVenue(K, t);
  else cardLockup(K, t);
}
