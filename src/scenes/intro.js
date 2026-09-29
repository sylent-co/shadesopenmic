// Act 1 (0 – 5.5 s): a droplet lands on the river at golden hour, the camera
// tilts up to the Himalayan horizon, nature "performs" in three lines, then
// everything is drawn into the sun, which becomes the SHADES red disc.
//
// Layers: K.L sharp (alpha-over), K.S soft (GPU-blurred, alpha-over, beneath
// L), K.G glow (additive HDR). Blur-in effects crossfade L -> S.

import { T, COPY, C } from '../config.js';
import { clamp, lerp, seg, ease, hash1, mulberry32, snoise1, fbm1, TAU, smoothstep, invLerp } from '../core/math.js';
import { font } from '../core/fonts.js';
import { layout, metrics } from './text.js';
import { cameraBasis, dirFromAngles, projectDir } from './camera.js';

export const SUN_EL = 0.14;
export const SUN_AZ = 0.0;
export const SUN_RAD = 0.028;
const PITCH_DOWN = -1.12;
const PITCH_LEVEL = 0.095;
const YAW_LINES = -0.29; // puts the sun on the right third
export const SOFT_MAX = 16; // px of blur represented by the soft layer

const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export const tapPulse = (t) => T.taps.reduce((s, tp) => s + (t > tp ? Math.exp(-(t - tp) * 16) * (1 - Math.exp(-(t - tp) * 120)) : 0), 0);

export function introCamera(t, portrait = false) {
  const tilt = smoother(invLerp(0.36, 2.75, t));
  let pitch = lerp(PITCH_DOWN, PITCH_LEVEL, tilt) + seg(t, 2.75, 4.3, ease.inOutSine) * 0.01;
  const push = seg(t, T.push[0], T.push[1], ease.inOutCubic);
  pitch = lerp(pitch, SUN_EL, push);
  const yl = portrait ? -0.06 : YAW_LINES;
  const yaw = lerp(yl + (portrait ? 0.03 : 0.06), yl, seg(t, 0.3, 4.3, ease.inOutSine)) * (1 - push);
  const roll = (0.006 * Math.sin(t * 1.2 + 0.4) + 0.003 * Math.sin(t * 2.3)) * (1 - push);
  const fovA = lerp(53, 47, seg(t, 0.3, 4.3, ease.inOutSine));
  const fov = Math.exp(lerp(Math.log(fovA), Math.log(7.0), push)) * (Math.PI / 180);
  const pos = [0, 1.0 + 0.012 * Math.sin(t * 1.05) * (1 - push), 0.05 * t];
  const basis = cameraBasis(yaw, pitch, roll);
  return { ...basis, pos, tanHalf: Math.tan(fov / 2), yaw, pitch, roll, push, tilt };
}

export const sunDir = () => dirFromAngles(SUN_AZ, SUN_EL);

export function introScene(t, cam) {
  const expo = t < T.impact ? 0.0 : lerp(0.05, 1.0, seg(t, T.impact, 1.9, ease.outCubic));
  const wind = smoothstep(1.8, 2.5, t) * (1 - smoothstep(3.6, 4.6, t)) + 0.15;
  const focus = seg(t, T.push[0] + 0.04, T.push[1] - 0.3, ease.inOutQuad);
  const brand = seg(t, T.push[0] + 0.12, T.push[1] - 0.32, ease.inOutQuad);
  return {
    uTime: t,
    uCamPos: cam.pos, uCamF: cam.f, uCamR: cam.r, uCamU: cam.u, uTanHalf: cam.tanHalf,
    uSunDir: sunDir(), uSunRad: SUN_RAD * (1 + 0.045 * tapPulse(t)),
    uNight: 0, uDrop: [0, 0.5, T.impact, 1], uWind: wind, uFocus: focus, uBrand: brand,
    uMark: 0, uMarkSweep: 0, uCalm: 0, uExposure: expo,
  };
}

// ---------------------------------------------------------------------------
// sprites (built once)

const sprites = {};
export function glowDot(size = 64) {
  const key = 'dot' + size;
  if (sprites[key]) return sprites[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.15, 'rgba(255,240,210,0.8)');
  g.addColorStop(0.45, 'rgba(255,200,140,0.18)');
  g.addColorStop(1, 'rgba(255,180,120,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, size, size);
  return (sprites[key] = c);
}

const LEAF_COLORS = [
  ['#F4B94C', '#B8561C'], ['#E8902E', '#8F2E14'], ['#F7D063', '#C4731E'],
  ['#D2482A', '#6E150C'], ['#EDA83E', '#9A4A17'], ['#DC6E2A', '#7A2410'],
];
function leafShape(x, kind) {
  x.beginPath();
  if (kind === 0) { // pipal (sacred fig) with its drip tip
    x.moveTo(0, 0);
    x.bezierCurveTo(0.04, -0.46, 0.52, -0.54, 0.70, -0.14);
    x.quadraticCurveTo(0.80, -0.04, 1.0, 0);
    x.quadraticCurveTo(0.80, 0.04, 0.70, 0.14);
    x.bezierCurveTo(0.52, 0.54, 0.04, 0.46, 0, 0);
  } else if (kind === 1) {
    x.moveTo(0, 0);
    x.bezierCurveTo(0.22, -0.40, 0.74, -0.34, 1, 0);
    x.bezierCurveTo(0.74, 0.34, 0.22, 0.40, 0, 0);
  } else {
    x.moveTo(0, 0);
    x.bezierCurveTo(0.30, -0.19, 0.72, -0.16, 1, 0);
    x.bezierCurveTo(0.72, 0.16, 0.30, 0.19, 0, 0);
  }
  x.closePath();
}
function leafSprite(kind, ci, blur, back) {
  const key = `leaf${kind}_${ci}_${blur}_${back ? 1 : 0}`;
  if (sprites[key]) return sprites[key];
  const Lz = 220, pad = 50;
  const c = document.createElement('canvas');
  c.width = Lz + pad * 2; c.height = Lz * 0.95 + pad * 2;
  const x = c.getContext('2d');
  x.translate(pad + Lz * 0.08, c.height / 2);
  x.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  x.scale(Lz * 0.9, Lz * 0.9);
  const [light, dark] = LEAF_COLORS[ci];
  leafShape(x, kind);
  const g = x.createRadialGradient(0.42, -0.02, 0.02, 0.45, 0, 0.64);
  g.addColorStop(0, back ? dark : light);
  g.addColorStop(1, back ? '#3A120A' : dark);
  x.fillStyle = g;
  x.fill();
  if (blur < 3) {
    x.strokeStyle = back ? 'rgba(255,200,150,0.10)' : 'rgba(255,238,195,0.38)';
    x.lineWidth = 0.012;
    x.beginPath(); x.moveTo(-0.08, 0); x.lineTo(0.9, 0); x.stroke();
    x.lineWidth = 0.006;
    for (let i = 1; i <= 5; i++) {
      const s = i / 6.2, w = kind === 2 ? 0.1 : 0.26;
      x.beginPath(); x.moveTo(s * 0.9, 0); x.quadraticCurveTo(s * 0.9 + 0.08, -w * 0.5, s * 0.9 + 0.16, -w * (1 - s * 0.6)); x.stroke();
      x.beginPath(); x.moveTo(s * 0.9, 0); x.quadraticCurveTo(s * 0.9 + 0.08, w * 0.5, s * 0.9 + 0.16, w * (1 - s * 0.6)); x.stroke();
    }
  }
  x.strokeStyle = back ? '#2A0D06' : dark;
  x.lineWidth = 0.02;
  x.beginPath(); x.moveTo(-0.1, 0.01); x.lineTo(0.02, 0); x.stroke();
  return (sprites[key] = { c, ox: pad + Lz * 0.08, oy: c.height / 2, L: Lz });
}

// ---------------------------------------------------------------------------
// deterministic element sets

const rng = mulberry32(20261024);
const LEAVES = Array.from({ length: 58 }, () => {
  const z = 0.42 + Math.pow(rng(), 0.9) * 2.1;
  return {
    z,
    kind: rng() < 0.5 ? 0 : rng() < 0.6 ? 1 : 2,
    ci: Math.floor(rng() * LEAF_COLORS.length),
    ts: T.leaves[0] + rng() * 0.85 + (z < 0.7 ? 0.35 : 0),
    dur: (1.05 + rng() * 0.6) * Math.pow(z, 0.3),
    y0: 0.35 + rng() * 0.75,
    amp: 0.03 + rng() * 0.07,
    freq: 0.5 + rng() * 0.8,
    ph: rng() * TAU,
    rot0: rng() * TAU,
    spin: (rng() - 0.5) * 5,
    flip0: rng() * TAU,
    flipSpeed: 3 + rng() * 6,
    size: 0.85 + rng() * 0.5,
    climb: 0.35 + rng() * 0.45,
  };
}).sort((a, b) => b.z - a.z);

const REEDS = (() => {
  const r = mulberry32(77);
  const out = [];
  for (const side of [-1, 1]) {
    const n = side < 0 ? 30 : 20;
    for (let i = 0; i < n; i++) {
      const u = r();
      const spread = side < 0 ? 0.24 : 0.16;
      out.push({
        side,
        x: side < 0 ? -0.02 + Math.pow(u, 1.5) * spread : 1.02 - Math.pow(u, 1.5) * spread,
        h: (side < 0 ? 0.22 + r() * 0.34 : 0.14 + r() * 0.22) * (1 - Math.pow(u, 1.5) * 0.45),
        w: 0.0035 + r() * 0.0045,
        lean: side * (0.05 + r() * 0.12) + (r() - 0.5) * 0.08,
        ph: r() * TAU,
        cattail: r() < 0.16,
      });
    }
  }
  return out;
})();

const FIREFLIES = Array.from({ length: 30 }, (_, i) => {
  const r = mulberry32(900 + i);
  return { x: r(), y: 0.58 + r() * 0.32, s: 0.5 + r(), ph: r() * 100, sp: 0.2 + r() * 0.5 };
});

const WIND = Array.from({ length: 26 }, (_, i) => {
  const r = mulberry32(4000 + i);
  return {
    y: 0.16 + r() * 0.6, t0: 1.70 + r() * 1.25, dur: 1.1 + r() * 0.8, len: 0.28 + r() * 0.35,
    a1: 0.012 + r() * 0.03, k1: 3 + r() * 5, p1: r() * TAU, a2: 0.006 + r() * 0.012, k2: 9 + r() * 10, p2: r() * TAU,
    w: 0.8 + r() * 1.8, alpha: 0.25 + r() * 0.4,
  };
});

const BIRDS = Array.from({ length: 5 }, (_, i) => {
  const r = mulberry32(5100 + i);
  return { t0: 1.5 + i * 0.1 + r() * 0.15, dur: 2.8 + r() * 0.6, y: 0.24 + r() * 0.06 + i * 0.013, s: 0.010 + r() * 0.005, ph: r() * TAU, dx: r() * 0.06 };
});

// ---------------------------------------------------------------------------

function drawDroplet(K, t) {
  const { G, W, H } = K;
  const t0 = T.dropFall, t1 = T.impact;
  if (t > t0 && t < t1 + 0.02) {
    const p = ease.inQuad(clamp((t - t0) / (t1 - t0)));
    const y = lerp(-0.08 * H, 0.5 * H, p);
    const len = lerp(0.03, 0.12, p) * H;
    const g = G.createLinearGradient(0, y - len, 0, y);
    g.addColorStop(0, 'rgba(255,220,170,0)');
    g.addColorStop(1, 'rgba(255,240,215,1)');
    G.fillStyle = g;
    G.fillRect(W / 2 - 1.6, y - len, 3.2, len);
    G.drawImage(glowDot(), W / 2 - 0.022 * H, y - 0.022 * H, 0.044 * H, 0.044 * H);
  }
  if (t >= t1 && t < t1 + 0.9) {
    const a = t - t1;
    const r = (0.05 + a * 0.5) * H;
    G.globalAlpha = Math.exp(-a * 5.5);
    G.drawImage(glowDot(128), W / 2 - r, H / 2 - r, 2 * r, 2 * r);
    G.globalAlpha = 1;
  }
}

function drawReeds(K, t, cam, wind) {
  const { L, G, W, H } = K;
  const rise = (1 - cam.tilt) * 0.75 + cam.push * 0.6;
  if (rise > 0.99) return;
  const fade = 1 - cam.push;
  L.save();
  L.globalAlpha = fade;
  const Hs = Math.min(H, W * 1.1);
  for (const r of REEDS) {
    const baseX = r.x * W, baseY = H * (1.02 + rise);
    const h = r.h * Hs;
    const sway = r.lean + wind * 0.22 * (0.7 + 0.3 * Math.sin(t * 1.7 + r.ph)) + 0.025 * Math.sin(t * 2.2 + r.ph) + 0.02 * fbm1(t * 0.9 + r.ph);
    const tipX = baseX + sway * h * 1.1, tipY = baseY - h * (1 - Math.abs(sway) * 0.35);
    const cx = baseX + sway * h * 0.25, cy = baseY - h * 0.55;
    const N = 14;
    const left = [], right = [];
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const x = (1 - s) * (1 - s) * baseX + 2 * (1 - s) * s * cx + s * s * tipX;
      const y = (1 - s) * (1 - s) * baseY + 2 * (1 - s) * s * cy + s * s * tipY;
      const dx = 2 * (1 - s) * (cx - baseX) + 2 * s * (tipX - cx);
      const dy = 2 * (1 - s) * (cy - baseY) + 2 * s * (tipY - cy);
      const dl = Math.hypot(dx, dy) || 1;
      const w = r.w * Hs * Math.pow(1 - s, 0.9) + 0.4;
      left.push([x - (dy / dl) * w, y + (dx / dl) * w]);
      right.push([x + (dy / dl) * w, y - (dx / dl) * w]);
    }
    L.beginPath();
    L.moveTo(left[0][0], left[0][1]);
    for (const p of left) L.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) L.lineTo(right[i][0], right[i][1]);
    L.closePath();
    L.fillStyle = '#0A0710';
    L.fill();
    if (r.cattail) {
      const s = 0.8;
      const x = (1 - s) * (1 - s) * baseX + 2 * (1 - s) * s * cx + s * s * tipX;
      const y = (1 - s) * (1 - s) * baseY + 2 * (1 - s) * s * cy + s * s * tipY;
      L.save();
      L.translate(x, y);
      L.rotate(Math.atan2(tipY - cy, tipX - cx) + Math.PI / 2);
      L.beginPath();
      L.ellipse(0, 0, r.w * Hs * 1.9, h * 0.07, 0, 0, TAU);
      L.fillStyle = '#130A0E';
      L.fill();
      L.restore();
    }
    G.globalAlpha = 0.18 * fade;
    G.strokeStyle = '#FFB070';
    G.lineWidth = 1;
    G.beginPath();
    const edge = r.side < 0 ? right : left;
    G.moveTo(edge[3][0], edge[3][1]);
    for (let i = 3; i < edge.length; i++) G.lineTo(edge[i][0], edge[i][1]);
    G.stroke();
    G.globalAlpha = 1;
  }
  L.restore();
}

function drawFireflies(K, t, cam) {
  const { G, W, H } = K;
  const vis = smoothstep(0.9, 1.8, t) * (1 - smoothstep(4.0, 4.5, t));
  if (vis <= 0) return;
  const dot = glowDot(64);
  const lift = (1 - cam.tilt) * 0.6;
  for (const f of FIREFLIES) {
    const x = (f.x + 0.03 * snoise1(t * f.sp + f.ph) + 0.004 * t) * W;
    const y = (f.y + lift + 0.03 * snoise1(t * f.sp * 1.3 + f.ph + 40)) * H;
    const tw = Math.pow(0.5 + 0.5 * Math.sin(t * (2 + f.sp * 4) + f.ph), 2.0);
    const s = (0.006 + 0.008 * f.s) * H;
    G.globalAlpha = vis * (0.25 + 0.75 * tw) * 0.8;
    G.drawImage(dot, x - s, y - s, 2 * s, 2 * s);
  }
  G.globalAlpha = 1;
}

function drawWind(K, t, cam) {
  const { G, W, H } = K;
  const lift = (1 - cam.tilt) * 0.6;
  G.save();
  G.lineCap = 'round';
  G.strokeStyle = '#FFE3BC';
  for (const s of WIND) {
    const u = (t - s.t0) / s.dur;
    if (u <= 0 || u >= 1.35) continue;
    const head = lerp(-0.2, 1.25, ease.inOutSine(clamp(u)));
    const tail = head - s.len * (0.4 + 0.6 * Math.sin(Math.PI * clamp(u)));
    const env = Math.sin(Math.PI * clamp(u / 1.1)) * (1 - smoothstep(1.0, 1.35, u));
    const N = 20;
    let prev = null;
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const xn = lerp(tail, head, k);
      const yn = s.y + lift + s.a1 * Math.sin(xn * s.k1 + s.p1 + t * 1.3) + s.a2 * Math.sin(xn * s.k2 + s.p2 - t * 2.1);
      const p = [xn * W, yn * H];
      if (prev) {
        G.globalAlpha = s.alpha * env * Math.pow(k, 1.5);
        G.lineWidth = s.w * (0.35 + 0.65 * k);
        G.beginPath(); G.moveTo(prev[0], prev[1]); G.lineTo(p[0], p[1]); G.stroke();
      }
      prev = p;
    }
  }
  G.restore();
  G.globalAlpha = 1;
}

function drawBirds(K, t, cam) {
  const { L, W, H } = K;
  const lift = (1 - cam.tilt) * 0.8;
  L.save();
  L.strokeStyle = '#1A0F1C';
  L.lineCap = 'round';
  for (const b of BIRDS) {
    const u = (t - b.t0) / b.dur;
    if (u <= 0 || u >= 1) continue;
    const x = lerp(0.40 + b.dx, 0.98, u) * W;
    const y = (b.y + lift + 0.012 * Math.sin(u * 5 + b.ph) - 0.04 * u) * H;
    const s = b.s * H;
    const flap = Math.sin(t * TAU * 3.1 + b.ph);
    L.globalAlpha = Math.sin(Math.PI * u) * 0.9 * (1 - cam.push);
    L.lineWidth = Math.max(1.2, s * 0.17);
    L.beginPath();
    L.moveTo(x - s, y - flap * s * 0.55);
    L.quadraticCurveTo(x - s * 0.45, y - s * 0.15 - flap * s * 0.2, x, y + s * 0.08);
    L.quadraticCurveTo(x + s * 0.45, y - s * 0.15 - flap * s * 0.2, x + s, y - flap * s * 0.55);
    L.stroke();
  }
  L.restore();
}

function drawLeaves(K, t, cam, sunPx, near) {
  const { L, G, H, W } = K;
  if (t < T.leaves[0] || t > T.leaves[1] + 0.3) return;
  const conv = seg(t, 4.22, 4.92, ease.inCubic);
  for (const lf of LEAVES) {
    if (near !== lf.z < 0.95) continue;
    const u = (t - lf.ts) / lf.dur;
    if (u < -0.02 || u > 1.08) continue;
    const s = (0.11 * lf.size / lf.z) * Math.min(H, W);
    // gust: sweep from lower-left to upper-right with an S-curve and flutter
    let x = lerp(-0.18, 1.18, u) * W;
    let y = (lf.y0 - lf.climb * u + lf.amp * Math.sin(TAU * lf.freq * u + lf.ph)) * H;
    const age = t - lf.ts;
    const rot = lf.rot0 + lf.spin * age + 0.5 * Math.sin(age * 3 + lf.ph);
    const flip = Math.cos(lf.flip0 + lf.flipSpeed * age);
    let scale = 1, alpha = 1;
    if (conv > 0 && sunPx) {
      const k = conv * clamp(1.3 - lf.z * 0.1);
      const ang = k * 2.2;
      const dx = x - sunPx.x, dy = y - sunPx.y;
      x = sunPx.x + (dx * Math.cos(ang) - dy * Math.sin(ang)) * (1 - k);
      y = sunPx.y + (dx * Math.sin(ang) + dy * Math.cos(ang)) * (1 - k);
      scale = 1 - k * 0.85;
      alpha = 1 - smoothstep(0.5, 1, k);
    }
    const blur = lf.z < 0.6 ? 16 : lf.z < 0.85 ? 7 : lf.z > 2.0 ? 2 : 0;
    const sp = leafSprite(lf.kind, lf.ci, blur, flip < 0);
    L.save();
    L.globalAlpha = alpha * (lf.z < 0.6 ? 0.85 : 1) * (lf.z > 1.9 ? 0.8 : 1);
    L.translate(x, y);
    L.rotate(rot);
    L.scale((s / sp.L) * Math.max(0.08, Math.abs(flip)) * scale, (s / sp.L) * scale);
    L.drawImage(sp.c, -sp.ox, -sp.oy);
    L.restore();
    const face = Math.pow(Math.abs(flip), 24);
    if (face > 0.2 && lf.z > 0.6) {
      const gs = s * 0.45 * scale;
      G.globalAlpha = face * 0.3 * alpha;
      G.drawImage(glowDot(64), x - gs, y - gs, 2 * gs, 2 * gs);
      G.globalAlpha = 1;
    }
  }
}

function drawFlare(K, t, sunPx, cam) {
  const { G, W } = K;
  if (!sunPx) return;
  const vis = smoothstep(1.0, 2.2, t) * (1 - cam.push * 0.9);
  if (vis <= 0.01) return;
  const fx = clamp(sunPx.x / W, 0.05, 0.95);
  const g = G.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, 'rgba(255,150,90,0)');
  g.addColorStop(clamp(fx - 0.3, 0.01, 0.97), 'rgba(255,170,110,0)');
  g.addColorStop(fx, 'rgba(255,215,170,0.5)');
  g.addColorStop(clamp(fx + 0.3, 0.02, 0.99), 'rgba(255,170,110,0)');
  g.addColorStop(1, 'rgba(255,150,90,0)');
  G.fillStyle = g;
  G.globalAlpha = vis * 0.45;
  G.fillRect(0, sunPx.y - 1.1, W, 2.2);
  G.globalAlpha = vis * 0.14;
  G.fillRect(0, sunPx.y - 5, W, 10);
  G.globalAlpha = 1;
}

/** Draw a glyph with an apparent blur by crossfading sharp (L) and soft (S). */
export function blurGlyph(K, ch, x, y, rot, alpha, blur, color, fontStr, halo = 0) {
  const k = clamp(blur / SOFT_MAX);
  for (const [ctx, a] of [[K.L, alpha * (1 - k)], [K.S, alpha * (k + halo)]]) {
    if (a <= 0.003) continue;
    ctx.save();
    ctx.font = fontStr;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = color;
    ctx.fillText(ch.ch, -ch.w / 2, 0);
    ctx.restore();
  }
}

function drawIntroLine(K, t, idx) {
  const { L, W, H } = K;
  const tIn = T.introIn[idx], tOut = T.introOut[idx];
  if (t < tIn - 0.05 || t > tOut + 0.9) return;
  const line = COPY.intro[idx];
  const portrait = H > W;
  const size = portrait ? 0.084 * W : 0.088 * H;
  const fReg = font('serif', size), fIt = font('serifIt', size);
  const segs = [
    { text: line.pre, f: fReg, color: C.cream },
    { text: line.verb, f: fIt, color: '#FFDDB0' },
    { text: line.post, f: fReg, color: '#FF4F2E' },
  ];
  let total = 0;
  const lays = segs.map((s) => { const l = layout(L, s.text, s.f); const o = { ...s, l, x0: total }; total += l.width; return o; });
  const m = metrics(L, 'serif');
  const x0 = portrait ? (W - total) / 2 : 0.105 * W;
  const baseY = (portrait ? 0.27 : 0.43) * H + (m.cap * size) / 2;
  const nChars = lays.reduce((a, s) => a + s.l.chars.length, 0);
  let ci = 0;
  for (const s of lays) {
    for (const ch of s.l.chars) {
      const i = ci++;
      if (ch.ch === ' ') continue;
      const pin = ease.outCubic(clamp((t - tIn - i * 0.026) / 0.72));
      // exits travel rightward, so the rightmost letters leave first (no collisions)
      const order = idx === 2 ? Math.floor(hash1(i * 3.7 + 11) * nChars) : nChars - 1 - i;
      const q = ease.inCubic(clamp((t - tOut - order * 0.011) / 0.38));
      if (pin <= 0 || q >= 1) continue;
      const h1 = hash1(i + idx * 31), h2 = hash1(i * 7.3 + idx);
      let dx = 0, dy = (1 - pin) * 0.03 * H, rot = 0;
      let blur = (1 - pin) * 15;
      if (idx === 0) { dx += q * 0.07 * H * (1 + 0.15 * h1); }
      if (idx === 1) { dx += q * 0.22 * H * (1 + 0.15 * h1); dy += -q * 0.035 * H * (0.5 + h2); rot = q * (h1 - 0.3) * 0.35; }
      if (idx === 2) { dx += q * 0.06 * H * (h1 - 0.1); dy += q * 0.09 * H * (0.3 + h2); rot = q * (h1 - 0.5) * 2.4; }
      blur += q * 16;
      const alpha = Math.pow(pin, 1.3) * (1 - q);
      blurGlyph(K, ch, x0 + s.x0 + ch.x + ch.w / 2 + dx, baseY + dy, rot, alpha, blur, s.color, s.f, 0.18);
    }
  }
}

function drawTurn(K, t, sunPx) {
  const { L, W, H } = K;
  if (t < T.turn - 0.05 || t > T.drop + 0.25) return;
  const pulse = tapPulse(t);
  const size = 0.13 * Math.min(H, W);
  const f = font('serifIt', size);
  const words = COPY.turn;
  const gap = size * 0.22;
  const lays = words.map((w) => layout(L, w, f));
  const total = lays.reduce((a, l) => a + l.width, 0) + gap;
  const cx = sunPx ? sunPx.x : W / 2, cy = sunPx ? sunPx.y : H / 2;
  const m = metrics(L, 'serifIt');
  const baseY = cy + (m.cap * size) / 2 - size * 0.02;
  const out = seg(t, T.drop - 0.02, T.drop + 0.18, ease.inCubic);
  let x = cx - total / 2;
  words.forEach((w, i) => {
    const p = ease.outCubic(clamp((t - (T.turn + i * 0.22)) / 0.5));
    if (p > 0) {
      const sc = (1.1 - 0.1 * p) * (1 + 0.03 * pulse) * (1 + out * 1.8);
      const bx = x + lays[i].width / 2;
      const blur = (1 - p) * 16 + out * 16;
      const k = clamp(blur / SOFT_MAX);
      for (const [ctx, a] of [[K.L, p * (1 - out) * (1 - k)], [K.S, p * (1 - out) * (k + 0.22)]]) {
        ctx.save();
        ctx.font = f;
        ctx.translate(cx + (bx - cx) * (1 + out * 1.3), baseY);
        ctx.scale(sc, sc);
        ctx.globalAlpha = Math.min(1, a);
        ctx.fillStyle = '#FFF6EE';
        ctx.fillText(w, -lays[i].width / 2, 0);
        ctx.restore();
      }
    }
    x += lays[i].width + gap;
  });
}

export function drawIntro(K, t, cam) {
  const sunPx = projectDir(cam, sunDir(), K.W, K.H);
  const wind = smoothstep(1.8, 2.5, t) * (1 - smoothstep(3.6, 4.6, t));
  drawDroplet(K, t);
  drawFlare(K, t, sunPx, cam);
  drawBirds(K, t, cam);
  drawWind(K, t, cam);
  drawFireflies(K, t, cam);
  drawLeaves(K, t, cam, sunPx, false);
  for (let i = 0; i < 3; i++) drawIntroLine(K, t, i);
  drawReeds(K, t, cam, wind);
  drawLeaves(K, t, cam, sunPx, true);
  drawTurn(K, t, sunPx);
  return { sunPx };
}
