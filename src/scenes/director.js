// Routes time to scenes and mixes post-processing presets.

import { T } from '../config.js';
import { lerp, seg, ease, wobble } from '../core/math.js';
import { natureCamera, natureScene, drawNature, shotAt, lightning } from './nature.js';
import { drawFast, fastImpulses } from './fast.js';
import { endCamera, endScene, drawEnd } from './end.js';

const PRESETS = {
  river: { bloom: 0.62, bloomThreshold: 0.85, warm: 0.65, sat: 1.06, contrast: 1.05, vignette: 0.55, grain: 0.034, halation: 0.10, ca: 0.0016, glowGain: 2.4 },
  storm: { bloom: 0.45, bloomThreshold: 0.8, warm: 0.0, sat: 0.82, contrast: 1.12, vignette: 0.6, grain: 0.04, halation: 0.04, ca: 0.0018, glowGain: 2.6 },
  night: { bloom: 0.95, bloomThreshold: 0.55, warm: 0.1, sat: 1.1, contrast: 1.06, vignette: 0.6, grain: 0.036, halation: 0.06, ca: 0.0014, glowGain: 2.8 },
  dawn: { bloom: 0.6, bloomThreshold: 0.85, warm: 0.45, sat: 1.05, contrast: 1.04, vignette: 0.5, grain: 0.032, halation: 0.09, ca: 0.0014, glowGain: 2.4 },
  fast: { bloom: 0.20, bloomThreshold: 1.0, warm: 0.0, sat: 1.0, contrast: 1.0, vignette: 0.18, grain: 0.030, halation: 0.02, ca: 0.0012, glowGain: 2.0 },
  end: { bloom: 0.22, bloomThreshold: 0.95, warm: 0.08, sat: 1.02, contrast: 1.05, vignette: 0.45, grain: 0.030, halation: 0.03, ca: 0.0012, glowGain: 2.0 },
};
const mixPreset = (a, b, k) => Object.fromEntries(Object.keys(a).map((key) => [key, lerp(a[key], b[key], k)]));

// Every landscape uniform, so scenes never inherit stale GL state.
const SCENE_DEFAULTS = {
  uNight: 0, uDrop: [0, 0, 0, 0], uWind: 0.15, uFocus: 0, uBrand: 0, uMark: 0, uMarkSweep: 0, uCalm: 0, uExposure: 1,
  uStorm: 0, uRain: 0, uLightning: 0, uDawn: 0, uMist: 0, uSunVis: 1,
};

function impulses(t) {
  // [time, strength, freq, decay]
  const list = [
    [T.shots[1], 0.5, 8, 6], [T.lightning[0] + 0.06, 0.9, 7, 4], [T.lightning[1] + 0.05, 0.35, 8, 5],
    [T.drop, 1.0, 9, 7], ...fastImpulses(), [T.endHit, 0.9, 7, 6],
  ];
  let sx = 0, sy = 0, rot = 0, zoom = 0, ca = 0;
  for (const [t0, s, f, d] of list) {
    const a = t - t0;
    if (a < 0 || a > 1.2) continue;
    sx += s * 0.010 * wobble(a, f, d);
    sy += s * 0.008 * wobble(a, f * 1.31, d);
    rot += s * 0.004 * wobble(a, f * 0.77, d);
    zoom += s * 0.035 * Math.exp(-a * d * 1.3);
    ca += s * 0.010 * Math.exp(-a * d);
  }
  return { sx, sy, rot, zoom, ca };
}

function naturePreset(t) {
  const s = shotAt(t);
  if (s === 0) return { ...PRESETS.river };
  if (s === 1) return { ...PRESETS.storm };
  return mixPreset(PRESETS.night, PRESETS.dawn, seg(t, T.dawn[0], T.dawn[1], ease.inOutSine));
}

export function frameState(t, portrait = false) {
  let post;
  if (t < T.drop) post = naturePreset(t);
  else if (t < T.endHit) post = mixPreset(PRESETS.dawn, PRESETS.fast, seg(t, T.drop, T.drop + 0.08));
  else post = mixPreset(PRESETS.fast, PRESETS.end, seg(t, T.endHit, T.endHit + 0.4));
  const imp = impulses(t);
  post.shake = [imp.sx, imp.sy];
  post.shakeRot = imp.rot;
  post.zoom = 1 + imp.zoom;
  post.ca += imp.ca;
  post.exposure = 1;
  post.layerGain = 1;
  post.sceneGain = 1;
  post.dirBlur = [0, 0];
  post.flash = 0;
  post.flashColor = [1, 1, 1];
  post.fade = seg(t, T.fadeOut[0], T.fadeOut[1], ease.inOutSine);
  post.letterbox = t < T.drop && !portrait ? 0.128 * (1 - seg(t, T.drop - 0.02, T.drop + 0.12, ease.inCubic)) : 0;
  if (shotAt(t) === 1 && t < T.drop) { post.flash = lightning(t) * 0.05; post.flashColor = [0.8, 0.86, 1.0]; }
  const fd = t - T.drop;
  if (fd >= 0 && fd < 0.3) { post.flash = Math.exp(-fd * 34) * 0.6; post.flashColor = [1.0, 0.85, 0.75]; }
  return post;
}

/** Draw 2D layers and build shader uniforms for time t. */
export function composeFrame(t, K) {
  const portrait = K.H > K.W;
  const post = frameState(t, portrait);
  let scene = null;
  if (t < T.drop + 0.25) {
    const cam = natureCamera(t, portrait);
    scene = natureScene(t, cam);
    drawNature(K, t, cam);
  }
  if (t >= T.drop - 0.001 && t < T.endHit + 0.3) drawFast(K, t, post);
  if (t >= T.endHit - 0.02) {
    const cam = endCamera(t, portrait);
    scene = endScene(t, cam);
    drawEnd(K, t, cam, post);
  }
  return { scene: scene && { ...SCENE_DEFAULTS, ...scene }, post };
}
