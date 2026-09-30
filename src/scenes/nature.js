// Act 1 (0 – 12 s): nature makes things without asking permission.
// A day cycle in four shots: the river at golden hour, a monsoon storm, a
// deodar forest at night full of fireflies, and a time-lapse dawn with a
// starling murmuration, ending in a push into the sun (which becomes the
// SHADES disc) and the question the rest of the film answers.
//
// Layers: K.L sharp (alpha-over), K.S soft (GPU-blurred), K.G additive glow.

import { T, COPY } from '../config.js';
import { clamp, lerp, seg, ease, hash1, mulberry32, snoise1, snoise2, fbm1, TAU, smoothstep, invLerp, wobble, mixHex } from '../core/math.js';
import { font } from '../core/fonts.js';
import { metrics } from './text.js';
import { cameraBasis, dirFromAngles, projectDir } from './camera.js';
import { glowDot, blurGlyph, richGlyphs, STYLE } from './fx.js';

export const SUN_RAD = 0.028;
const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export const tapPulse = (t) => T.taps.reduce((s, tp) => s + (t > tp ? Math.exp(-(t - tp) * 16) * (1 - Math.exp(-(t - tp) * 120)) : 0), 0);

/** 0 river, 1 monsoon, 2 night forest + dawn (one continuous time-lapse shot). */
export const shotAt = (t) => (t < T.shots[1] ? 0 : t < T.shots[2] ? 1 : 2);

// ---- sun ----------------------------------------------------------------
const SUN1 = { az: 0, el: 0.14 };
const dawnSunEl = (t) => lerp(-0.1, 0.14, ease.outCubic(invLerp(T.dawn[0], 10.2, t)));
export function sunDir(t) {
  const s = shotAt(t);
  if (s === 0) return dirFromAngles(SUN1.az, SUN1.el);
  if (s === 1) return dirFromAngles(0.3, 0.2);
  return dirFromAngles(0, dawnSunEl(t));
}
const dawnK = (t) => seg(t, T.dawn[0], T.dawn[1], ease.inOutSine);

// ---- cameras ---------------------------------------------------------------
export function natureCamera(t, portrait = false) {
  const s = shotAt(t);
  let yaw, pitch, roll, fov, pos, push = 0, tilt = 1;
  if (s === 0) {
    tilt = smoother(invLerp(0.36, 2.2, t));
    pitch = lerp(-1.12, 0.095, tilt) + seg(t, 2.2, 2.6, ease.inOutSine) * 0.006;
    const yl = portrait ? -0.06 : -0.29;
    yaw = lerp(yl + 0.06, yl, seg(t, 0.3, 2.6, ease.inOutSine));
    roll = 0.006 * Math.sin(t * 1.2 + 0.4) + 0.003 * Math.sin(t * 2.3);
    fov = lerp(53, 48, seg(t, 0.3, 2.6, ease.inOutSine));
    pos = [0, 1.0 + 0.012 * Math.sin(t * 1.05), 0.05 * t];
  } else if (s === 1) {
    const u = t - T.shots[1];
    yaw = lerp(portrait ? 0.3 : 0.42, portrait ? 0.26 : 0.3, ease.inOutSine(clamp(u / 2.6)));
    pitch = 0.07 + 0.006 * Math.sin(u * 1.7);
    roll = -0.012 + 0.006 * Math.sin(u * 2.1);
    fov = lerp(60, 52, ease.inOutSine(clamp(u / 2.6)));
    pos = [0, 0.55, 3 + 0.3 * u];
  } else {
    const u = t - T.shots[2];
    yaw = lerp(portrait ? -0.16 : -0.42, portrait ? -0.02 : -0.2, seg(t, T.shots[2], T.push[0], ease.inOutSine));
    pitch = 0.085 + 0.004 * Math.sin(u * 0.9);
    roll = 0.004 * Math.sin(u * 0.8);
    fov = 50;
    pos = [0, 1.1, 0.04 * u];
    push = seg(t, T.push[0], T.push[1], ease.inOutCubic);
    const el = dawnSunEl(t);
    pitch = lerp(pitch, el, push);
    yaw = lerp(yaw, 0, push);
    roll *= 1 - push;
    fov = Math.exp(lerp(Math.log(fov), Math.log(7.0), push));
  }
  const basis = cameraBasis(yaw, pitch, roll);
  return { ...basis, pos, tanHalf: Math.tan((fov * Math.PI) / 360), yaw, pitch, roll, push, tilt, shot: s };
}

// ---- lightning ---------------------------------------------------------------
/** Flash envelope of a strike at t0: leader flicker, main stroke, restrike. */
function strike(t, t0) {
  const a = t - t0;
  if (a < -0.06 || a > 0.5) return 0;
  if (a < 0) return a > -0.04 ? 0.25 : 0;
  if (a < 0.05) return 1;
  if (a < 0.08) return 0.25;
  if (a < 0.13) return 0.85;
  return 0.85 * Math.exp(-(a - 0.13) * 11);
}
export function lightning(t) {
  if (shotAt(t) !== 1) return 0;
  const cutFlash = Math.exp(-Math.max(0, t - T.shots[1]) * 7) * 0.9;
  return Math.min(1.3, cutFlash + strike(t, T.lightning[0]) + 0.6 * strike(t, T.lightning[1]));
}

export function natureScene(t, cam) {
  const s = shotAt(t);
  const base = {
    uTime: t, uCamPos: cam.pos, uCamF: cam.f, uCamR: cam.r, uCamU: cam.u, uTanHalf: cam.tanHalf,
    uSunDir: sunDir(t), uSunRad: SUN_RAD, uNight: 0, uDrop: [0, 0, 0, 0], uWind: 0.15, uFocus: 0, uBrand: 0,
    uMark: 0, uMarkSweep: 0, uCalm: 0, uExposure: 1, uStorm: 0, uRain: 0, uLightning: 0, uDawn: 0, uMist: 0, uSunVis: 1,
  };
  if (s === 0) {
    return {
      ...base,
      uExposure: t < T.impact ? 0.0 : lerp(0.05, 1.0, seg(t, T.impact, 1.7, ease.outCubic)),
      uDrop: [0, 0.5, T.impact, 1],
      uWind: 0.15 + smoothstep(1.6, 2.4, t) * 0.5,
      uRain: smoothstep(2.35, 2.6, t) * 0.6,
    };
  }
  if (s === 1) {
    const L = lightning(t);
    return {
      ...base, uStorm: 1, uRain: 1, uWind: 1.2, uLightning: L * 0.3, uSunVis: 0,
      uExposure: lerp(1, 0.0, seg(t, 5.0, 5.2, ease.inQuad)) * (1 + 0.2 * L),
    };
  }
  const dk = dawnK(t);
  const push = cam.push;
  return {
    ...base,
    uNight: 1 - dk, uDawn: 1, uCalm: 1 - dk * 0.5, uMist: dk * 0.8, uWind: 0.1,
    uFocus: seg(t, T.push[0] + 0.04, T.push[1] - 0.3, ease.inOutQuad),
    uBrand: seg(t, T.push[0] + 0.12, T.push[1] - 0.32, ease.inOutQuad),
    uSunRad: SUN_RAD * (1 + 0.045 * tapPulse(t)),
    uExposure: seg(t, T.shots[2], T.shots[2] + 0.45, ease.outCubic) * (1 - 0.0 * push),
  };
}

// ---------------------------------------------------------------------------
// sprites

const cache = {};
const LEAF_COLORS = [
  ['#F4B94C', '#B8561C'], ['#E8902E', '#8F2E14'], ['#F7D063', '#C4731E'],
  ['#D2482A', '#6E150C'], ['#EDA83E', '#9A4A17'], ['#DC6E2A', '#7A2410'],
];
function leafSprite(kind, ci, blur, back, wet = false) {
  const key = `leaf${kind}_${ci}_${blur}_${back ? 1 : 0}_${wet ? 1 : 0}`;
  if (cache[key]) return cache[key];
  const Lz = 220, pad = 50;
  const c = document.createElement('canvas');
  c.width = Lz + pad * 2; c.height = Lz * 0.95 + pad * 2;
  const x = c.getContext('2d');
  x.translate(pad + Lz * 0.08, c.height / 2);
  x.filter = blur > 0 ? `blur(${blur}px)` : 'none';
  x.scale(Lz * 0.9, Lz * 0.9);
  let [light, dark] = LEAF_COLORS[ci];
  if (wet) { light = mixHex(light, '#2F4A3A', 0.55); dark = mixHex(dark, '#10201A', 0.5); }
  x.beginPath();
  if (kind === 0) {
    x.moveTo(0, 0); x.bezierCurveTo(0.04, -0.46, 0.52, -0.54, 0.70, -0.14); x.quadraticCurveTo(0.80, -0.04, 1.0, 0);
    x.quadraticCurveTo(0.80, 0.04, 0.70, 0.14); x.bezierCurveTo(0.52, 0.54, 0.04, 0.46, 0, 0);
  } else if (kind === 1) {
    x.moveTo(0, 0); x.bezierCurveTo(0.22, -0.40, 0.74, -0.34, 1, 0); x.bezierCurveTo(0.74, 0.34, 0.22, 0.40, 0, 0);
  } else {
    x.moveTo(0, 0); x.bezierCurveTo(0.30, -0.19, 0.72, -0.16, 1, 0); x.bezierCurveTo(0.72, 0.16, 0.30, 0.19, 0, 0);
  }
  x.closePath();
  const g = x.createRadialGradient(0.42, -0.02, 0.02, 0.45, 0, 0.64);
  g.addColorStop(0, back ? dark : light);
  g.addColorStop(1, back ? '#1A120A' : dark);
  x.fillStyle = g;
  x.fill();
  if (blur < 3) {
    x.strokeStyle = back ? 'rgba(255,200,150,0.10)' : 'rgba(255,238,195,0.35)';
    x.lineWidth = 0.012;
    x.beginPath(); x.moveTo(-0.08, 0); x.lineTo(0.9, 0); x.stroke();
  }
  return (cache[key] = { c, ox: pad + Lz * 0.08, oy: c.height / 2, L: Lz });
}

/** Deodar (Himalayan cedar) silhouettes: tiered, drooping boughs. */
const TREE_PATHS = Array.from({ length: 14 }, (_, v) => {
  const r = mulberry32(900 + v);
  const p = new Path2D();
  const tiers = 8 + Math.floor(r() * 6);
  const lean = (r() - 0.5) * 0.06;
  const side = (sign) => {
    const pts = [];
    for (let k = 1; k <= tiers; k++) {
      const f = k / tiers;
      const y = -1 + f * 0.9;
      const wOut = (0.03 + 0.34 * Math.pow(f, 0.85)) * (0.7 + r() * 0.6);
      const droop = 0.02 + r() * 0.05;
      const mid = wOut * (0.5 + r() * 0.2);
      // ragged bough: a few needles-clump bumps between trunk and tip
      pts.push([sign * mid, y - 0.01], [sign * (mid + (wOut - mid) * 0.5), y + (r() - 0.6) * 0.02], [sign * wOut, y + droop], [sign * wOut * (0.3 + r() * 0.2), y + droop * 0.6]);
    }
    return pts;
  };
  const right = side(1), left = side(-1);
  p.moveTo(lean * 0.5 + 0.012, -1.04);
  for (const [x, y] of right) p.lineTo(x + lean * (1 + y), y);
  p.lineTo(0.02, -0.07); p.lineTo(0.028, 0.02); p.lineTo(-0.028, 0.02); p.lineTo(-0.02, -0.07);
  for (let i = left.length - 1; i >= 0; i--) p.lineTo(left[i][0] + lean * (1 + left[i][1]), left[i][1]);
  p.closePath();
  return p;
});

// ---------------------------------------------------------------------------
// deterministic element sets

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

const BIRDS = Array.from({ length: 5 }, (_, i) => {
  const r = mulberry32(5100 + i);
  return { t0: 1.3 + i * 0.1 + r() * 0.15, dur: 2.2 + r() * 0.5, y: 0.24 + r() * 0.06 + i * 0.013, s: 0.010 + r() * 0.005, ph: r() * TAU, dx: r() * 0.06 };
});

const WIND = Array.from({ length: 18 }, (_, i) => {
  const r = mulberry32(4000 + i);
  return {
    y: 0.16 + r() * 0.6, t0: 1.5 + r() * 0.9, dur: 1.0 + r() * 0.7, len: 0.28 + r() * 0.35,
    a1: 0.012 + r() * 0.03, k1: 3 + r() * 5, p1: r() * TAU, a2: 0.006 + r() * 0.012, k2: 9 + r() * 10, p2: r() * TAU,
    w: 0.8 + r() * 1.8, alpha: 0.2 + r() * 0.35,
  };
});

const RAIN = [
  { n: 520, len: 0.03, w: 1.0, a: 0.16, v: 2.4, seed: 1 },
  { n: 260, len: 0.065, w: 1.4, a: 0.22, v: 3.4, seed: 2 },
  { n: 70, len: 0.15, w: 2.4, a: 0.26, v: 5.2, seed: 3 },
].map((l) => {
  const r = mulberry32(700 + l.seed);
  return { ...l, drops: Array.from({ length: l.n }, () => [r(), r(), 0.7 + r() * 0.6]) };
});

const STORM_LEAVES = Array.from({ length: 26 }, (_, i) => {
  const r = mulberry32(3300 + i);
  const z = 0.5 + r() * 1.8;
  return { z, kind: Math.floor(r() * 3), ci: Math.floor(r() * 6), ts: 2.75 + r() * 2.0, dur: (0.8 + r() * 0.5) * Math.pow(z, 0.3), y0: 0.1 + r() * 0.8, amp: 0.04 + r() * 0.1, ph: r() * TAU, rot0: r() * TAU, spin: (r() - 0.5) * 9, flip0: r() * TAU, fs: 5 + r() * 8, fall: 0.15 + r() * 0.35 };
}).sort((a, b) => b.z - a.z);

function makeBolt(seed, x0, y0, x1, y1, depth = 6) {
  const r = mulberry32(seed);
  let pts = [[x0, y0], [x1, y1]];
  let disp = Math.hypot(x1 - x0, y1 - y0) * 0.22;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      next.push([(ax + bx) / 2 + (r() - 0.5) * disp, (ay + by) / 2 + (r() - 0.5) * disp * 0.25], pts[i + 1]);
    }
    pts = next;
    disp *= 0.55;
  }
  const branches = [];
  for (let b = 0; b < 4; b++) {
    const i = Math.floor((0.15 + r() * 0.55) * pts.length);
    const [sx, sy] = pts[i];
    const len = (0.08 + r() * 0.14);
    const dir = r() < 0.5 ? -1 : 1;
    const bp = [[sx, sy]];
    let [cx, cy] = [sx, sy];
    for (let k = 0; k < 14; k++) { cx += dir * len * 0.05 * (0.4 + r()); cy += len * 0.07 * (0.5 + r()); bp.push([cx, cy]); }
    branches.push(bp);
  }
  return { pts, branches };
}
const BOLTS = [makeBolt(11, 0.70, -0.05, 0.76, 0.55), makeBolt(23, 0.18, -0.05, 0.12, 0.5)];

const TREES = (() => {
  const r = mulberry32(4242);
  const layers = [
    { n: 120, par: 1.0, h: [0.035, 0.11], drop: 0.003, col: ['#0C1229', '#3E3050'] },
    { n: 34, par: 1.9, h: [0.14, 0.34], drop: 0.05, col: ['#060913', '#21192D'] },
    { n: 7, par: 3.2, h: [0.62, 0.95], drop: 0.22, col: ['#020307', '#0E0A14'] },
  ];
  return layers.map((L, li) => {
    const trees = [];
    let az = -1.35;
    for (let i = 0; i < L.n; i++) {
      // clustered spacing: groves with occasional clearings
      az += (2.3 / L.n) * (r() < 0.12 ? 2.4 : 0.35 + r() * 0.9);
      const a = li === 2 ? [-1.25, -1.07, -0.95, 0.35, 0.52, 0.66, 0.84][i] : az;
      trees.push({ az: a, h: lerp(L.h[0], L.h[1], Math.pow(r(), 0.8)), v: Math.floor(r() * TREE_PATHS.length), w: 0.65 + r() * 0.8 });
    }
    trees.sort((a, b) => b.h - a.h);
    return { ...L, trees };
  });
})();

const FIREFLIES = Array.from({ length: 190 }, (_, i) => {
  const r = mulberry32(8800 + i);
  const z = 0.35 + Math.pow(r(), 0.7) * 2.6;
  return { az: -1.0 + r() * 1.7, z, hgt: 0.02 + r() * 0.22, f: 0.35 + r() * 0.5, ph: r(), dx: r() * 100, dy: r() * 100, sp: 0.15 + r() * 0.3 };
});

const FLOCK = (() => {
  const r = mulberry32(6060);
  return Array.from({ length: 560 }, () => {
    const u1 = Math.max(1e-6, r()), u2 = r();
    const m = Math.sqrt(-2 * Math.log(u1));
    return { gx: m * Math.cos(TAU * u2), gy: m * Math.sin(TAU * u2), s: 0.7 + r() * 0.6, ph: r() * TAU };
  });
})();

// ---------------------------------------------------------------------------
// drawing helpers

const horizonY = (cam, H, W) => {
  const p = projectDir(cam, [Math.sin(cam.yaw), 0, Math.cos(cam.yaw)], W, H);
  return p ? p.y : H / 2;
};
/** Screen x for an azimuth with a parallax factor relative to the camera yaw. */
const azToX = (cam, az, par, W, H) => W / 2 + ((az - cam.yaw) * par) / (2 * cam.tanHalf) * H;

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

function drawReeds(K, t, rise, wind, fade = 1, dark = '#0A0710', rim = '#FFB070') {
  const { L, G, W, H } = K;
  if (rise > 0.99 || fade <= 0) return;
  const Hs = Math.min(H, W * 1.1);
  L.save();
  L.globalAlpha = fade;
  for (const r of REEDS) {
    const baseX = r.x * W, baseY = H * (1.02 + rise);
    const h = r.h * Hs;
    const gust = wind * (0.7 + 0.3 * Math.sin(t * 1.7 + r.ph)) + 0.08 * wind * Math.sin(t * 9 + r.ph * 3);
    const sway = r.lean + gust * 0.22 + 0.025 * Math.sin(t * 2.2 + r.ph) + 0.02 * fbm1(t * 0.9 + r.ph);
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
    L.fillStyle = dark;
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
      L.fill();
      L.restore();
    }
    if (rim) {
      G.globalAlpha = 0.18 * fade;
      G.strokeStyle = rim;
      G.lineWidth = 1;
      G.beginPath();
      const edge = r.side < 0 ? right : left;
      G.moveTo(edge[3][0], edge[3][1]);
      for (let i = 3; i < edge.length; i++) G.lineTo(edge[i][0], edge[i][1]);
      G.stroke();
      G.globalAlpha = 1;
    }
  }
  L.restore();
}

function drawWind(K, t, lift) {
  const { G, W, H } = K;
  G.save();
  G.lineCap = 'round';
  G.strokeStyle = '#FFE3BC';
  for (const s of WIND) {
    const u = (t - s.t0) / s.dur;
    if (u <= 0 || u >= 1.35) continue;
    const head = lerp(-0.2, 1.25, ease.inOutSine(clamp(u)));
    const tail = head - s.len * (0.4 + 0.6 * Math.sin(Math.PI * clamp(u)));
    const env = Math.sin(Math.PI * clamp(u / 1.1)) * (1 - smoothstep(1.0, 1.35, u));
    let prev = null;
    for (let i = 0; i <= 20; i++) {
      const k = i / 20;
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
}

function drawBirds(K, t, lift, alpha = 1) {
  const { L, W, H } = K;
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
    L.globalAlpha = Math.sin(Math.PI * u) * 0.9 * alpha;
    L.lineWidth = Math.max(1.2, s * 0.17);
    L.beginPath();
    L.moveTo(x - s, y - flap * s * 0.55);
    L.quadraticCurveTo(x - s * 0.45, y - s * 0.15 - flap * s * 0.2, x, y + s * 0.08);
    L.quadraticCurveTo(x + s * 0.45, y - s * 0.15 - flap * s * 0.2, x + s, y - flap * s * 0.55);
    L.stroke();
  }
  L.restore();
}

function drawFlare(K, t, sunPx, vis) {
  const { G, W } = K;
  if (!sunPx || vis <= 0.01) return;
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

// ---- monsoon ---------------------------------------------------------------
function drawRain(K, t, amount) {
  const { L, G, W, H } = K;
  if (amount <= 0) return;
  const slant = 0.24;
  L.save();
  L.lineCap = 'round';
  for (const layer of RAIN) {
    L.beginPath();
    for (const [rx, ry, sp] of layer.drops) {
      const y = (((ry + t * layer.v * sp * 0.42) % 1.2) - 0.1) * H;
      const x = (rx * 1.4 - 0.2) * W + y * slant;
      const len = layer.len * H * sp;
      L.moveTo(x, y);
      L.lineTo(x - len * slant, y - len);
    }
    L.strokeStyle = `rgba(205,218,232,${layer.a * amount})`;
    L.lineWidth = layer.w * (H / 1080);
    L.stroke();
  }
  L.restore();
  // splashes near the camera: tiny bright crowns
  const r = mulberry32(Math.floor(t * 30));
  G.save();
  G.fillStyle = 'rgba(210,225,240,0.5)';
  for (let i = 0; i < 40 * amount; i++) {
    const x = r() * W, y = H * (0.8 + r() * 0.2), s = (1 + r() * 2) * (H / 1080);
    G.globalAlpha = 0.25 + r() * 0.3;
    G.fillRect(x - s, y - s * 3, s * 2, s * 2);
  }
  G.restore();
}

function drawBolt(K, bolt, amt, W, H) {
  const { G } = K;
  if (amt <= 0.02) return;
  const path = (pts) => { G.beginPath(); pts.forEach(([x, y], i) => (i ? G.lineTo(x * W, y * H) : G.moveTo(x * W, y * H))); };
  G.save();
  G.lineJoin = 'round';
  G.lineCap = 'round';
  for (const [w, a] of [[34, 0.05], [12, 0.18], [4, 0.6], [1.8, 1]]) {
    G.strokeStyle = a === 1 ? '#FFFFFF' : '#BFD4FF';
    G.globalAlpha = a * amt;
    G.lineWidth = w * (H / 1080);
    path(bolt.pts); G.stroke();
    G.lineWidth = w * 0.55 * (H / 1080);
    for (const b of bolt.branches) { path(b); G.stroke(); }
  }
  G.restore();
}

function drawStormLeaves(K, t) {
  const { L, W, H } = K;
  for (const lf of STORM_LEAVES) {
    const u = (t - lf.ts) / lf.dur;
    if (u < 0 || u > 1.05) continue;
    const s = (0.08 / lf.z) * Math.min(W, H);
    const x = lerp(1.15, -0.15, u) * W;
    const y = (lf.y0 + lf.fall * u + lf.amp * Math.sin(TAU * u * 1.3 + lf.ph)) * H;
    const age = t - lf.ts;
    const flip = Math.cos(lf.flip0 + lf.fs * age);
    const sp = leafSprite(lf.kind, lf.ci, lf.z < 0.7 ? 12 : 0, flip < 0, true);
    L.save();
    L.globalAlpha = lf.z < 0.7 ? 0.8 : 0.95;
    L.translate(x, y);
    L.rotate(lf.rot0 + lf.spin * age);
    L.scale((s / sp.L) * Math.max(0.08, Math.abs(flip)), s / sp.L);
    L.drawImage(sp.c, -sp.ox, -sp.oy);
    L.restore();
  }
}

// ---- night forest & dawn -----------------------------------------------------
function drawForest(K, t, cam, fade) {
  const { L, W, H } = K;
  if (fade <= 0) return;
  const hy = horizonY(cam, H, W);
  const dk = dawnK(t);
  TREES.forEach((layer, li) => {
    const ctx = L;
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.fillStyle = mixHex(layer.col[0], layer.col[1], dk);
    for (const tr of layer.trees) {
      const x = azToX(cam, tr.az, layer.par, W, H);
      const hpx = tr.h * H;
      if (x < -hpx || x > W + hpx) continue;
      const base = hy + layer.drop * H + (li === 2 ? H * 0.12 : 0);
      ctx.save();
      ctx.translate(x, base);
      ctx.scale(hpx * tr.w, hpx);
      ctx.fill(TREE_PATHS[tr.v]);
      ctx.restore();
    }
    ctx.restore();
    // fog band in front of each far layer
    if (li < 2) {
      const fy = hy + layer.drop * H;
      const g = L.createLinearGradient(0, fy - 0.06 * H, 0, fy + 0.02 * H);
      const fc = dk > 0.5 ? '255,214,196' : '120,140,200';
      g.addColorStop(0, `rgba(${fc},0)`);
      g.addColorStop(1, `rgba(${fc},${(0.10 + 0.15 * dk) * fade})`);
      L.fillStyle = g;
      L.fillRect(0, fy - 0.06 * H, W, 0.08 * H);
    }
  });
}

const FIREFLY = [190, 255, 90];
/** Firefly brightness: independent blinks that fall silent, then flash in sync. */
function fireflyBlink(ff, t) {
  const own = Math.pow(Math.max(0, Math.sin(TAU * (t * ff.f + ff.ph))), 6);
  const hush = 1 - smoothstep(T.sync - 0.55, T.sync - 0.2, t);
  const pulses = [T.sync, T.sync + 0.42].reduce((s, tp) => s + Math.exp(-Math.pow((t - tp - ff.az * 0.02) / 0.07, 2)), 0);
  const after = smoothstep(T.sync + 0.5, T.sync + 0.8, t) * own;
  return own * hush * (t < T.sync - 0.2 ? 1 : 0) + pulses * 1.25 + after;
}

function drawFireflies(K, t, cam, fade) {
  const { G, W, H } = K;
  if (fade <= 0) return;
  const hy = horizonY(cam, H, W);
  const spr = glowDot(64, FIREFLY);
  for (const ff of FIREFLIES) {
    const par = 1 + 2.4 / ff.z;
    const x = azToX(cam, ff.az, par * 0.6, W, H) + snoise1(t * ff.sp + ff.dx) * 0.03 * W / ff.z;
    const water = hy + (0.015 + 0.25 / ff.z) * H * 0.55;
    const hpx = (ff.hgt + 0.03 * snoise1(t * ff.sp * 1.3 + ff.dy)) * H / Math.sqrt(ff.z);
    const y = water - hpx;
    if (x < -60 || x > W + 60) continue;
    const b = fireflyBlink(ff, t) * fade;
    if (b < 0.01) continue;
    const s = (0.005 + 0.012 / ff.z) * H;
    G.globalAlpha = Math.min(1, b) * (ff.z < 0.6 ? 0.45 : 0.95);
    G.drawImage(spr, x - s, y - s, 2 * s, 2 * s);
    // reflection on the still water
    G.globalAlpha *= 0.28;
    G.drawImage(spr, x - s, water + hpx * 0.9 - s * 1.6, 2 * s, 3.2 * s);
  }
  G.globalAlpha = 1;
}

function drawMoon(K, t, cam, fade) {
  const { L, G, W, H } = K;
  if (fade <= 0) return;
  const p = projectDir(cam, dirFromAngles(-0.08 - 0.02 * (t - T.shots[2]), 0.3 - 0.03 * (t - T.shots[2])), W, H);
  if (!p) return;
  const r = 0.032 * H;
  G.globalAlpha = 0.55 * fade;
  G.drawImage(glowDot(128, [150, 170, 255]), p.x - r * 5, p.y - r * 5, r * 10, r * 10);
  G.globalAlpha = 1;
  L.save();
  L.globalAlpha = fade;
  L.beginPath(); L.arc(p.x, p.y, r, 0, TAU); L.arc(p.x + r * 0.42, p.y - r * 0.18, r * 0.9, 0, TAU, true);
  L.fillStyle = '#F4EEDC';
  L.fill('evenodd');
  L.restore();
}

function flockPos(b, t, W, H, sunPx) {
  const u = t - 7.9;
  const cx = (0.12 + 0.34 * ease.inOutSine(clamp(u / 2.4)) + 0.04 * Math.sin(u * 1.7)) * W;
  const cy = (0.24 + 0.05 * Math.sin(u * 1.2 + 0.5)) * H;
  const th = 0.5 * Math.sin(u * 0.8) + 0.25 * Math.sin(u * 1.9);
  const sx = 0.11 * W * (1 + 0.45 * Math.sin(u * 1.3));
  const sy = 0.045 * H * (1 + 0.55 * Math.cos(u * 1.1 + 1));
  let ox = b.gx * sx, oy = b.gy * sy;
  oy += 0.025 * H * Math.sin(b.gx * 2.2 + u * 3.6); // a wave rolling through the flock
  ox += 0.02 * W * snoise2(b.gx * 0.8 + u * 0.6, b.gy * 0.8);
  let x = cx + ox * Math.cos(th) - oy * Math.sin(th);
  let y = cy + ox * Math.sin(th) + oy * Math.cos(th);
  const k = seg(t, T.push[0] - 0.1, T.push[0] + 0.7, ease.inCubic);
  if (k > 0 && sunPx) {
    const ang = k * 3.0 + b.ph * 0.2;
    const dx = x - sunPx.x, dy = y - sunPx.y;
    x = sunPx.x + (dx * Math.cos(ang) - dy * Math.sin(ang)) * (1 - k);
    y = sunPx.y + (dx * Math.sin(ang) + dy * Math.cos(ang)) * (1 - k);
  }
  return [x, y, k];
}

function drawFlock(K, t, sunPx) {
  const { L, W, H } = K;
  const on = smoothstep(7.9, 8.3, t);
  if (on <= 0 || t > T.push[0] + 0.75) return;
  L.save();
  L.fillStyle = '#1B1022';
  const sz = Math.max(1.4, 0.0026 * H);
  for (const b of FLOCK) {
    const [x, y, k] = flockPos(b, t, W, H, sunPx);
    const flap = 0.6 + 0.4 * Math.sin(t * 22 + b.ph);
    L.globalAlpha = on * 0.85 * (1 - k);
    L.fillRect(x - sz * b.s, y - sz * 0.5 * flap, sz * 2 * b.s, sz * flap);
  }
  L.restore();
}

// ---------------------------------------------------------------------------
// copy

function lineGlyphs(K, idx) {
  const { L, W, H } = K;
  const portrait = H > W;
  const size = portrait ? 0.08 * W : 0.086 * H;
  const lines = COPY.nature[idx];
  const m = metrics(L, 'serif');
  const lineGap = 1.16;
  const blockH = (lines.length - 1) * size * lineGap;
  const cy = (portrait ? 0.15 : 0.42) * H;
  const y0 = cy - blockH / 2 + (m.cap * size) / 2;
  return richGlyphs(L, lines, size, { x0: portrait ? W / 2 : 0.105 * W, y0, align: portrait ? 'center' : 'left', lineGap });
}

function drawNatureLine(K, t, idx) {
  const { G, H } = K;
  const tIn = T.textIn[idx], tOut = T.textOut[idx];
  if (t < tIn - 0.05 || t > tOut + 0.8) return;
  const { glyphs, count } = lineGlyphs(K, idx);
  const thunder = idx === 1 ? wobble(t - (T.lightning[0] + 0.06), 9, 5) : 0;
  for (const g of glyphs) {
    if (g.ch === ' ') continue;
    const i = g.idx;
    const pin = ease.outCubic(clamp((t - tIn - i * 0.022) / 0.7));
    let order = count - 1 - i;
    if (idx === 1 || idx === 2) order = Math.floor(hash1(i * 3.7 + idx * 11) * count);
    const q = ease.inCubic(clamp((t - tOut - order * 0.009) / 0.42));
    if (pin <= 0 || q >= 1) continue;
    const h1 = hash1(i + idx * 31), h2 = hash1(i * 7.3 + idx);
    let dx = 0, dy = (1 - pin) * 0.03 * H, rot = 0, blur = (1 - pin) * 15, sc = 1, halo = 0.16;
    const accent = g.style === 'i';
    if (idx === 0) {
      // the river: the key word keeps flowing
      if (accent) dy += Math.sin(i * 0.8 - t * 6) * 0.006 * H * pin;
      dx += q * 0.08 * H * (1 + 0.15 * h1);
    } else if (idx === 1) {
      if (accent) {
        const jolt = clamp(thunder * 1.6, -1, 1);
        sc = 1 + 0.18 * Math.max(0, jolt) * (1 - q);
        dx += jolt * 0.006 * H * (h1 - 0.5) * 4;
        dy += jolt * 0.004 * H * (h2 - 0.5) * 4;
      }
      // rain washes the words down
      dy += q * 0.16 * H * (0.5 + h2);
      blur += q * 12;
    } else if (idx === 2) {
      if (accent) {
        const b = fireflyBlink({ f: 0.9, ph: h1, az: 0 }, t + h2 * 0.3);
        G.globalAlpha = Math.min(1, b) * pin * (1 - q) * 0.8;
        const s = 0.05 * H;
        G.drawImage(glowDot(64, FIREFLY), g.cx - s, g.y - s * 1.2, 2 * s, 2 * s);
        G.globalAlpha = 1;
      }
      // float up and dissolve like fireflies
      dy -= q * 0.12 * H * (0.4 + h2);
      dx += q * 0.04 * H * (h1 - 0.5);
      blur += q * 16;
    } else if (idx === 3) {
      if (accent) {
        const rise = ease.outCubic(clamp((t - tIn - 0.35 - (i % 5) * 0.05) / 0.8));
        dy += (1 - rise) * 0.05 * H;
        const s = 0.07 * H;
        G.globalAlpha = 0.35 * pin * (1 - q);
        G.drawImage(glowDot(64, [255, 170, 110]), g.cx - s, g.y - s * 1.1, 2 * s, 2 * s);
        G.globalAlpha = 1;
      }
      // swept off by the flock
      dx += q * 0.22 * H * (1 + 0.3 * h1);
      dy -= q * 0.05 * H * h2;
      rot = q * (h1 - 0.3) * 0.5;
    }
    const alpha = Math.pow(pin, 1.3) * (1 - q);
    blurGlyph(K, g, g.cx + dx, g.y + dy, rot, alpha, blur, g.color, g.font, halo, sc, idx === 3 ? 0.9 : 0.5);
  }
}

function drawWhy(K, t, sunPx) {
  const { L, W, H } = K;
  if (t < T.why - 0.05 || t > T.drop + 0.25) return;
  const pulse = tapPulse(t);
  const size = 0.12 * Math.min(H, W);
  const cx = sunPx ? sunPx.x : W / 2, cy = sunPx ? sunPx.y : H / 2;
  const m = metrics(L, 'serif');
  const styles = { ...STYLE, r: { key: 'serif', color: '#FFF6EE' }, i: { key: 'serifIt', color: '#FFF6EE' }, d: { key: 'serif', color: '#FFD9C8' } };
  const { glyphs } = richGlyphs(L, [COPY.why], size, { x0: cx, y0: cy + (m.cap * size) / 2, align: 'center', styles });
  const out = seg(t, T.drop - 0.02, T.drop + 0.18, ease.inCubic);
  for (const g of glyphs) {
    if (g.ch === ' ') continue;
    const p = ease.outCubic(clamp((t - T.why - g.idx * 0.035) / 0.5));
    if (p <= 0) continue;
    const sc = (1.08 - 0.08 * p) * (1 + 0.03 * pulse) * (1 + out * 1.8);
    const x = cx + (g.cx - cx) * sc;
    blurGlyph(K, g, x, g.y, 0, p * (1 - out), (1 - p) * 16 + out * 16, g.color, g.font, 0.22, sc);
  }
}

export function drawNature(K, t, cam) {
  const { W, H } = K;
  const s = shotAt(t);
  const sunPx = projectDir(cam, sunDir(t), W, H);
  if (s === 0) {
    const lift = (1 - cam.tilt) * 0.6;
    drawDroplet(K, t);
    drawFlare(K, t, sunPx, smoothstep(1.0, 2.0, t));
    drawBirds(K, t, lift);
    drawWind(K, t, lift);
    drawNatureLine(K, t, 0);
    drawReeds(K, t, (1 - cam.tilt) * 0.75, smoothstep(1.6, 2.5, t) * 0.8);
    drawRain(K, t, smoothstep(2.3, 2.6, t) * 0.5);
  } else if (s === 1) {
    for (const [i, b] of BOLTS.entries()) drawBolt(K, b, i === 0 ? strike(t, T.lightning[0]) : 0.6 * strike(t, T.lightning[1]), W, H);
    drawRain(K, t, 1);
    drawStormLeaves(K, t);
    drawNatureLine(K, t, 1);
    drawReeds(K, t, 0.05, 1.6, 1, '#05070A', null);
  } else {
    const dk = dawnK(t);
    const fadeAll = 1 - cam.push;
    drawMoon(K, t, cam, (1 - dk) * fadeAll);
    drawForest(K, t, cam, fadeAll);
    drawFireflies(K, t, cam, (1 - smoothstep(T.dawn[0] + 0.1, T.dawn[1], t)) * fadeAll);
    drawFlare(K, t, sunPx, dk * (1 - cam.push * 0.9) * smoothstep(-0.02, 0.04, dawnSunEl(t)));
    drawFlock(K, t, sunPx);
    drawNatureLine(K, t, 2);
    drawNatureLine(K, t, 3);
    drawWhy(K, t, sunPx);
  }
  return { sunPx };
}
