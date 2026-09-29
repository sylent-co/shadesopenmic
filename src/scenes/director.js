// Routes time to scenes and mixes post-processing presets.

import { T } from '../config.js';
import { lerp, seg, ease, wobble } from '../core/math.js';
import { introCamera, introScene, drawIntro } from './intro.js';
import { drawFast, fastImpulses } from './fast.js';
import { endCamera, endScene, drawEnd } from './end.js';

const PRESETS = {
  intro: { bloom: 0.62, bloomThreshold: 0.85, warm: 0.65, sat: 1.06, contrast: 1.05, vignette: 0.55, grain: 0.034, halation: 0.10, ca: 0.0016, glowGain: 2.4 },
  fast: { bloom: 0.20, bloomThreshold: 1.0, warm: 0.0, sat: 1.0, contrast: 1.0, vignette: 0.18, grain: 0.030, halation: 0.02, ca: 0.0012, glowGain: 2.0 },
  end: { bloom: 0.22, bloomThreshold: 0.95, warm: 0.08, sat: 1.02, contrast: 1.05, vignette: 0.45, grain: 0.030, halation: 0.03, ca: 0.0012, glowGain: 2.0 },
};
const mixPreset = (a, b, k) => Object.fromEntries(Object.keys(a).map((key) => [key, lerp(a[key], b[key], k)]));

function impulses(t) {
  // [time, strength, freq, decay]
  const list = [[T.drop, 1.0, 9, 7], ...fastImpulses(), [T.endHit, 0.9, 7, 6]];
  let sx = 0, sy = 0, rot = 0, zoom = 0, ca = 0, flash = 0;
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

export function frameState(t, portrait = false) {
  let post;
  if (t < T.drop) post = { ...PRESETS.intro };
  else if (t < T.endHit) post = mixPreset(PRESETS.intro, PRESETS.fast, seg(t, T.drop, T.drop + 0.08));
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
  // drop flash
  const fd = t - T.drop;
  if (fd >= 0 && fd < 0.3) { post.flash = Math.exp(-fd * 34) * 0.6; post.flashColor = [1.0, 0.85, 0.75]; }
  return post;
}

/** Draw 2D layers and build shader uniforms for time t. */
export function composeFrame(t, K) {
  const portrait = K.H > K.W;
  const post = frameState(t, portrait);
  let scene = null;
  let cam = null;
  if (t < T.drop + 0.25) {
    cam = introCamera(t, portrait);
    scene = introScene(t, cam);
  }
  if (t >= T.endHit - 0.02) {
    cam = endCamera(t);
    scene = endScene(t, cam);
  }
  if (t < T.drop + 0.25) drawIntro(K, t, introCamera(t, portrait));
  if (t >= T.drop - 0.001 && t < T.endHit + 0.3) drawFast(K, t, post);
  if (t >= T.endHit - 0.02) drawEnd(K, t, cam, post);
  return { scene, post };
}
