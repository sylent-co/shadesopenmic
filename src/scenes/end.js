// Act 3 (12.0 – 16.5 s): the full stop becomes the SHADES disc, hanging like
// a red moon over the night river (bookending the opening sunset), then the
// event lockup builds beneath it.

import { T, EVENT, C } from '../config.js';
import { clamp, lerp, seg, ease, smoothstep } from '../core/math.js';
import { font } from '../core/fonts.js';
import { layout, metrics } from './text.js';
import { cameraBasis, dirFromAngles, projectDir } from './camera.js';
import { SOFT_MAX } from './intro.js';

const SUN_EL = 0.49;
const SUN_RAD = 0.1;

export function endCamera(t) {
  const H0 = SUN_RAD / (2 * 0.24); // tanHalf giving a 0.24H radius disc
  const H1 = SUN_RAD / (2 * 0.118);
  const k = seg(t, 12.42, 13.15, ease.inOutCubic);
  const drift = seg(t, 13.15, 16.5, ease.inOutSine);
  const tanHalf = lerp(H0, H1, k) * (1 - 0.035 * drift);
  const pitch = lerp(SUN_EL, 0.296, k) + 0.004 * drift;
  const basis = cameraBasis(0, pitch, 0);
  return { ...basis, pos: [0, 1.0 + 0.004 * Math.sin(t * 0.9), 0.02 * t], tanHalf, k };
}

export function endScene(t, cam) {
  return {
    uTime: t,
    uCamPos: cam.pos, uCamF: cam.f, uCamR: cam.r, uCamU: cam.u, uTanHalf: cam.tanHalf,
    uSunDir: dirFromAngles(0, SUN_EL), uSunRad: SUN_RAD,
    uNight: 1, uDrop: [0, 0, 0, 0], uWind: 0.1,
    uFocus: 1 - seg(t, 12.35, 13.0, ease.inOutQuad),
    uBrand: 1, uMark: 1, uMarkSweep: lerp(-0.1, 1.15, seg(t, 12.03, 12.45, ease.inOutCubic)),
    uCalm: 1, uExposure: 1,
  };
}

/** Letters rise from a mask; returns width. */
function riseLine(K, text, fontStr, cx, base, capPx, t0, t, stagger, color, alpha = 1, tracking = 0) {
  const { L } = K;
  const lw = layout(L, text, fontStr, tracking);
  const x0 = cx - lw.width / 2;
  for (const ch of lw.chars) {
    const p = ease.snap(clamp((t - t0 - ch.i * stagger) / 0.32));
    if (p <= 0 || ch.ch === ' ') continue;
    L.save();
    L.beginPath();
    L.rect(x0 + ch.x - capPx * 0.2, base - capPx * 1.3, ch.w + capPx * 0.4, capPx * 1.62);
    L.clip();
    L.font = fontStr;
    L.globalAlpha = alpha;
    L.fillStyle = color;
    L.fillText(ch.ch, x0 + ch.x, base + (1 - p) * capPx * 1.25);
    L.restore();
  }
  return lw.width;
}

function fadeLine(K, text, fontStr, cx, base, t0, t, color, alpha, tracking = 0, stagger = 0.012) {
  const { L, S } = K;
  const lw = layout(L, text, fontStr, tracking);
  const x0 = cx - lw.width / 2;
  for (const ch of lw.chars) {
    const p = ease.outCubic(clamp((t - t0 - ch.i * stagger) / 0.4));
    if (p <= 0 || ch.ch === ' ') continue;
    const blur = (1 - p) * 14;
    const k = clamp(blur / SOFT_MAX);
    for (const [ctx, a] of [[L, p * (1 - k)], [S, p * k]]) {
      if (a < 0.01) continue;
      ctx.save();
      ctx.font = fontStr;
      ctx.globalAlpha = a * alpha;
      ctx.fillStyle = color;
      ctx.fillText(ch.ch, x0 + ch.x, base + (1 - p) * 6);
      ctx.restore();
    }
  }
  return lw.width;
}

export function drawEnd(K, t, cam, post) {
  const { L, S, G, W, H } = K;
  if (t < T.endHit) return;
  const portrait = H > W;
  const U = portrait ? W * 0.95 : H;
  const cx = W / 2;
  // disc sits at y = 0.5 - 0.24 * (…) in screen space: follow the camera
  const sp = projectDir(cam, dirFromAngles(0, SUN_EL), W, H);
  const discY = sp ? sp.y : H * 0.3;
  const discR = SUN_RAD / (2 * cam.tanHalf) * H;
  // soft red glow around the disc to seat it in the night
  G.globalAlpha = 0.07 * smoothstep(12.0, 12.6, t);
  const g = G.createRadialGradient(cx, discY, discR * 0.9, cx, discY, discR * 3.2);
  g.addColorStop(0, 'rgba(255,60,30,0.9)');
  g.addColorStop(1, 'rgba(255,40,20,0)');
  G.fillStyle = g;
  G.fillRect(cx - discR * 3.3, discY - discR * 3.3, discR * 6.6, discR * 6.6);
  G.globalAlpha = 1;

  const base0 = portrait ? 0.46 : 0.455;
  const tl = T.endLock;
  // SHADES presents
  const fPres = font('mona', 0.024 * U, 620, 112);
  fadeLine(K, `${EVENT.host}  PRESENTS`, fPres, cx, H * base0, tl + 0.05, t, C.cream, 0.86, 0.024 * U * 0.45, 0.018);
  // OPEN MIC
  const capPx = (portrait ? 0.105 : 0.135) * U;
  const cap = metrics(L, 'mona', 900, 100).cap;
  const wd = lerp(125, 112, ease.outExpo(clamp((t - tl - 0.1) / 0.6)));
  const fTitle = font('mona', capPx / cap, 900, wd);
  const titleBase = H * base0 + 0.055 * U + capPx;
  const tw = riseLine(K, EVENT.title, fTitle, cx, titleBase, capPx, tl + 0.1, t, 0.03, '#FFF7EE');
  // roles
  const fRoles = font('mona', 0.0225 * U, 540, 100);
  const roles = EVENT.roles.map((r) => r.toUpperCase()).join('  ·  ');
  fadeLine(K, roles, fRoles, cx, titleBase + 0.066 * U, tl + 0.42, t, C.cream, 0.8, 0.0225 * U * 0.2, 0.006);
  // red rule
  const rp = ease.inOutCubic(clamp((t - tl - 0.55) / 0.45));
  if (rp > 0) {
    const rw = Math.min(tw, W * 0.8) * 0.36 * rp;
    L.fillStyle = '#FF3A1F';
    L.fillRect(cx - rw / 2, titleBase + 0.098 * U, rw, Math.max(2, 0.0028 * U));
  }
  // date + venue
  const fDate = font('mona', 0.04 * U, 760, 108);
  riseLine(K, `${EVENT.day} · ${EVENT.date}`, fDate, cx, titleBase + 0.172 * U, 0.04 * U * 0.72, tl + 0.62, t, 0.014, '#FFF7EE');
  const fVenue = font('mona', 0.029 * U, 580, 104);
  fadeLine(K, `${EVENT.venue.toUpperCase()}, ${EVENT.city.toUpperCase()}`, fVenue, cx, titleBase + 0.226 * U, tl + 0.78, t, C.cream, 0.88, 0.029 * U * 0.14, 0.01);
  // gentle breathing glow on the title
  S.save();
  S.globalAlpha = 0.07 * smoothstep(tl + 0.4, tl + 1.2, t) * (0.85 + 0.15 * Math.sin(t * 2.2));
  S.font = fTitle;
  S.fillStyle = '#FF6A45';
  S.textAlign = 'center';
  S.fillText(EVENT.title, cx, titleBase);
  S.restore();
}
