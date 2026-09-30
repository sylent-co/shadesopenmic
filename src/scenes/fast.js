// Act 2 (12 – 26.4 s): the things people keep to themselves, one bar each at
// 100 BPM. Every line lives in its own little world — a notes app, a fogged
// shower door, a building going dark at 2 AM, a hostel group chat, a record
// the neighbours can't escape — then "GIVE IT A MIC."

import { T, COPY, C } from '../config.js';
import { clamp, lerp, seg, ease, hash1, mulberry32, TAU, smoothstep, spring, rgba, noise1 } from '../core/math.js';
import { font } from '../core/fonts.js';
import { layout, textWidth } from './text.js';
import { glowDot } from './fx.js';
import {
  IDENT, setView, zoomM, beatEnv, riseTail, drawThat, drawHUD, STARS, sevenSeg, vinylCanvas, sceneClimax, keyLayout,
} from './kit.js';

const LINE = 2.4;
const lineAt = (t) => clamp(Math.floor((t - T.drop) / LINE), 0, 4);
const portraitOf = (K) => K.H > K.W;

// ---- shared -----------------------------------------------------------------

/** Key word letters with a per-letter transform callback. */
function drawKey(ctx, lay, word, color, fn) {
  const f = font('mona', lay.size, 900, lay.wdth);
  const lw = layout(ctx, word, f);
  for (const ch of lw.chars) {
    const st = fn(ch);
    if (!st || st.a <= 0) continue;
    ctx.save();
    const cx = lay.x0 + ch.x + ch.w / 2, cy = lay.baseline - lay.capPx / 2;
    ctx.translate(cx + (st.dx || 0), cy + (st.dy || 0));
    if (st.rot) ctx.rotate(st.rot);
    if (st.s !== undefined && st.s !== 1) ctx.scale(st.s, st.s);
    ctx.globalAlpha = Math.min(1, st.a);
    ctx.font = st.font || f;
    ctx.fillStyle = st.color || color;
    ctx.fillText(ch.ch, -ch.w / 2, lay.capPx / 2);
    ctx.restore();
  }
  return lw;
}

function textBlock(K, lay, lt, tail, colors, { that = 0.06, tailT = 0.42 } = {}) {
  drawThat(K, lay, lt, that, colors.sub);
  riseTail(K, tail, lay, lt, tailT, 0.05, colors, lay.alignRight);
}

// ---- 01 POEM — the notes app ---------------------------------------------------

const NOTE = {
  title: 'poem (don’t open)',
  date: '14 August 2023 at 2:47 AM',
  struck: 'i’m not really a poet',
  lines: ['the ceiling fan', 'has heard every verse', 'i never said out loud.'],
};

function phoneGeom(K) {
  const { W, H } = K;
  if (portraitOf(K)) { const h = 0.5 * H; return { cx: 0.5 * W, cy: 0.71 * H, h, w: h * 0.47, rot: -0.05 }; }
  const h = 0.84 * H;
  return { cx: 0.765 * W, cy: 0.53 * H, h, w: h * 0.47, rot: -0.07 };
}

function drawPhone(K, P, lt, t) {
  const { L, S } = K;
  const pe = ease.outBack(clamp((lt - 0.06) / 0.5), 1.15);
  if (pe <= 0) return;
  const { w, h } = P;
  const float = Math.sin(t * 1.7) * 0.006 * h;
  const tr = (ctx, k = 1) => {
    ctx.translate(P.cx * k, (P.cy + (1 - pe) * 1.0 * h + float) * k);
    ctx.rotate(P.rot + (1 - pe) * 0.28);
    ctx.scale(k, k);
  };
  // soft contact shadow
  S.save(); tr(S, 1); S.globalAlpha = 0.45; S.fillStyle = '#3A0500';
  S.beginPath(); S.roundRect(-w / 2 + 0.05 * w, -h / 2 + 0.06 * h, w, h, w * 0.14); S.fill(); S.restore();
  L.save();
  tr(L);
  L.fillStyle = '#0E0E10';
  L.beginPath(); L.roundRect(-w / 2, -h / 2, w, h, w * 0.15); L.fill();
  L.strokeStyle = 'rgba(255,255,255,0.14)'; L.lineWidth = Math.max(1, w * 0.006); L.stroke();
  const m = w * 0.035, sw = w - 2 * m, sh = h - 2 * m;
  L.translate(-w / 2 + m, -h / 2 + m);
  L.beginPath(); L.roundRect(0, 0, sw, sh, w * 0.12); L.clip();
  L.fillStyle = '#FBF7EE'; L.fillRect(0, 0, sw, sh);
  const fs = (k) => sw * k;
  // status bar + island
  L.fillStyle = '#111'; L.beginPath(); L.roundRect(sw * 0.34, sh * 0.018, sw * 0.32, sh * 0.034, sh * 0.017); L.fill();
  L.font = font('mona', fs(0.045), 650); L.textBaseline = 'middle';
  L.fillText('2:47', sw * 0.1, sh * 0.036);
  L.fillRect(sw * 0.8, sh * 0.03, sw * 0.08, sh * 0.013);
  // nav
  L.fillStyle = '#D69A12'; L.font = font('mona', fs(0.05), 560);
  L.fillText('‹ Notes', sw * 0.05, sh * 0.095);
  L.textAlign = 'right'; L.fillText('Done', sw * 0.95, sh * 0.095); L.textAlign = 'left';
  L.fillStyle = '#9A958C'; L.font = font('mona', fs(0.034), 480); L.textAlign = 'center';
  L.fillText(NOTE.date, sw / 2, sh * 0.15); L.textAlign = 'left';
  L.textBaseline = 'alphabetic';
  const px = sw * 0.08;
  L.fillStyle = '#17130E'; L.font = font('mona', fs(0.074), 800);
  L.fillText(NOTE.title, px, sh * 0.235);
  // the self-doubt line, struck through
  const fb = font('mona', fs(0.058), 440);
  L.font = fb; L.fillStyle = '#6E685F';
  const y0 = sh * 0.315;
  L.fillText(NOTE.struck, px, y0);
  const sk = ease.inOutCubic(clamp((lt - 0.38) / 0.3));
  if (sk > 0) { L.fillStyle = '#C8250E'; L.fillRect(px - sw * 0.01, y0 - fs(0.058) * 0.3, (textWidth(L, NOTE.struck, fb) + sw * 0.02) * sk, Math.max(1.5, fs(0.006))); }
  // typed poem
  L.fillStyle = '#17130E';
  const total = NOTE.lines.join('').length;
  let n = Math.floor(total * clamp((lt - 0.62) / 1.05));
  let caret = null;
  NOTE.lines.forEach((ln, i) => {
    const y = y0 + sh * (0.078 + i * 0.068);
    const shown = ln.slice(0, Math.max(0, n));
    n -= ln.length;
    if (shown.length) L.fillText(shown, px, y);
    if (!caret && (n < 0 || i === NOTE.lines.length - 1)) caret = [px + textWidth(L, shown, fb), y];
  });
  if (caret && Math.floor(t * 3.4) % 2 === 0) { L.fillStyle = '#D69A12'; L.fillRect(caret[0] + sw * 0.006, caret[1] - fs(0.058) * 0.82, Math.max(1.5, sw * 0.008), fs(0.058) * 1.02); }
  // toolbar
  L.fillStyle = '#D69A12';
  for (let i = 0; i < 4; i++) { L.beginPath(); L.arc(sw * (0.14 + i * 0.24), sh * 0.955, sw * 0.022, 0, TAU); L.fill(); }
  // glass sheen
  const g = L.createLinearGradient(0, 0, sw, sh);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.35, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  L.fillStyle = g; L.fillRect(0, 0, sw, sh);
  L.restore();
}

function steam(K, e) {
  const { L, W, H } = K;
  if (e <= 0) return;
  const top = H * (1.15 - 1.45 * e);
  L.save();
  L.fillStyle = 'rgba(232,238,237,1)';
  L.fillRect(0, top + 0.12 * H, W, H);
  for (let i = 0; i < 14; i++) {
    const x = (i / 13) * W, r = (0.16 + 0.06 * hash1(i)) * H;
    const y = top + 0.12 * H + Math.sin(i * 1.7 + e * 5) * 0.03 * H;
    const g = L.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(232,238,237,1)'); g.addColorStop(1, 'rgba(232,238,237,0)');
    L.fillStyle = g; L.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  L.restore();
}

function scenePoem(K, lt, t) {
  const { L, G, W, H } = K;
  const r0 = 0.229 * H, rMax = Math.hypot(W, H) / 2 + 10;
  const ir = lerp(r0, rMax, ease.outExpo(clamp(lt / 0.22)));
  L.save();
  L.beginPath(); L.arc(W / 2, H / 2, ir, 0, TAU); L.clip();
  const g = L.createRadialGradient(W * 0.4, H * 0.6, 0, W * 0.4, H * 0.6, Math.hypot(W, H) * 0.62);
  g.addColorStop(0, '#E4301A'); g.addColorStop(1, '#AE190A');
  L.fillStyle = g; L.fillRect(0, 0, W, H);
  const gap = 0.074 * H, off = (lt * 0.05 * H) % gap;
  L.fillStyle = rgba(C.cream, 0.09);
  for (let y = gap * 0.6 - off; y < H; y += gap) L.fillRect(0, y, W, Math.max(1, 0.0016 * H));
  L.fillStyle = rgba(C.cream, 0.15);
  L.fillRect(0.05 * W, 0, Math.max(1, 0.0022 * H), H);
  L.restore();
  if (ir > r0 + 2) drawPhone(K, phoneGeom(K), lt, t);
  // key: typed in, with a big caret
  const lay = keyLayout(K, 'POEM', 'left', { cy: 0.47 });
  const typeT = (i) => 0.1 + i * 0.075;
  const lw = drawKey(L, lay, 'POEM', C.cream, (ch) => {
    const a = lt - typeT(ch.i);
    if (a < 0) return null;
    return { a: 1, s: lerp(1.22, 1, ease.outBack(clamp(a / 0.2), 2.2)) };
  });
  const shown = lw.chars.filter((c) => lt >= typeT(c.i));
  if (lt > 0.08 && lt < 1.0 && Math.floor(lt * 6) % 2 === 0) {
    const last = shown[shown.length - 1];
    const cx = lay.x0 + (last ? last.x + last.w : 0) + lay.capPx * 0.06;
    L.fillStyle = C.cream;
    L.fillRect(cx, lay.top - lay.capPx * 0.06, Math.max(3, lay.capPx * 0.06), lay.capPx * 1.12);
  }
  textBlock(K, lay, lt, COPY.lines[0].tail, { sub: C.cream, accent: C.ink }, { tailT: 0.45 });
  // iris shock ring
  if (lt < 0.3) {
    G.save(); G.globalAlpha = (1 - lt / 0.3) * 0.9; G.strokeStyle = '#FFD2B8';
    G.lineWidth = (1 - lt / 0.3) * 0.02 * H + 1; G.beginPath(); G.arc(W / 2, H / 2, ir, 0, TAU); G.stroke(); G.restore();
  }
  steam(K, ease.inCubic(seg(lt, 2.06, 2.4)));
}

// ---- 02 SONG — written in the steam on a shower door ----------------------------

let fogCanvas = null, fogNoise = null;
function fogBuffers(W, H) {
  if (!fogCanvas || fogCanvas.width !== W || fogCanvas.height !== H) {
    fogCanvas = document.createElement('canvas');
    fogCanvas.width = W; fogCanvas.height = H;
  }
  if (!fogNoise) {
    fogNoise = document.createElement('canvas');
    fogNoise.width = fogNoise.height = 256;
    const x = fogNoise.getContext('2d');
    const img = x.createImageData(256, 256);
    const r = mulberry32(55);
    for (let i = 0; i < img.data.length; i += 4) { const v = 180 + r() * 75; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
    x.putImageData(img, 0, 0);
  }
  return fogCanvas.getContext('2d');
}
const CONDENSATION = Array.from({ length: 420 }, (_, i) => { const r = mulberry32(1200 + i); return [r(), r(), Math.pow(r(), 3)]; });
const DRIPS = Array.from({ length: 9 }, (_, i) => { const r = mulberry32(1500 + i); return { ch: i % 4, fx: 0.2 + r() * 0.6, t0: 0.5 + r() * 0.9, len: 0.08 + r() * 0.22 }; });

function sceneSong(K, lt, t) {
  const { L, S, G, W, H } = K;
  // tiles behind the glass (blurred by the soft layer)
  const ts = 0.105 * H;
  S.save();
  S.fillStyle = '#A9D2CC'; S.fillRect(0, 0, W, H);
  const r = mulberry32(9);
  for (let y = -ts; y < H + ts; y += ts) for (let x = -ts; x < W + ts; x += ts) {
    const v = r();
    S.fillStyle = v < 0.33 ? '#1F6C71' : v < 0.66 ? '#247A7F' : '#1B6166';
    S.fillRect(x + ts * 0.04, y + ts * 0.04, ts * 0.92, ts * 0.92);
  }
  const lg = S.createRadialGradient(W * 0.3, -H * 0.1, 0, W * 0.3, -H * 0.1, H * 1.4);
  lg.addColorStop(0, 'rgba(255,240,215,0.45)'); lg.addColorStop(1, 'rgba(0,20,25,0.25)');
  S.fillStyle = lg; S.fillRect(0, 0, W, H);
  S.restore();
  // fog
  const F = fogBuffers(W, H);
  F.setTransform(1, 0, 0, 1, 0, 0);
  F.globalCompositeOperation = 'source-over';
  F.globalAlpha = 1;
  F.clearRect(0, 0, W, H);
  F.fillStyle = 'rgba(232,238,237,0.95)'; F.fillRect(0, 0, W, H);
  F.globalAlpha = 0.14;
  F.drawImage(fogNoise, -((t * 12) % 64), 0, W + 64, H);
  F.globalAlpha = 1;
  F.globalCompositeOperation = 'destination-out';
  for (const [x, y, s] of CONDENSATION) {
    F.globalAlpha = 0.25 + 0.5 * s;
    F.beginPath(); F.arc(x * W, y * H, (0.0018 + 0.006 * s) * H, 0, TAU); F.fill();
  }
  const lay = keyLayout(K, 'SONG', 'center', { cy: 0.46, targetW: 0.6 });
  const fk = font('mona', lay.size, 900, lay.wdth);
  const lw = layout(F, 'SONG', fk);
  const writeT = (i) => 0.12 + i * 0.11;
  F.font = fk;
  F.fillStyle = '#000';
  for (const ch of lw.chars) {
    const p = clamp((lt - writeT(ch.i)) / 0.13);
    if (p <= 0) continue;
    F.save(); F.globalAlpha = 0.97;
    F.beginPath(); F.rect(lay.x0 + ch.x - 4, lay.top - lay.capPx * 0.3, (ch.w + 8) * ease.outQuad(p), lay.capPx * 1.6); F.clip();
    F.fillText(ch.ch, lay.x0 + ch.x, lay.baseline);
    F.restore();
  }
  // drips running out of the letters
  F.globalAlpha = 0.95;
  F.lineCap = 'round';
  for (const d of DRIPS) {
    const ch = lw.chars[d.ch];
    const p = ease.outCubic(clamp((lt - d.t0) / 0.9));
    if (p <= 0) continue;
    const x = lay.x0 + ch.x + ch.w * d.fx, y0 = lay.baseline - lay.capPx * 0.05, y1 = y0 + d.len * H * p;
    F.lineWidth = 0.006 * H;
    F.beginPath(); F.moveTo(x, y0); F.lineTo(x, y1); F.stroke();
    F.beginPath(); F.arc(x, y1, 0.0065 * H, 0, TAU); F.fill();
  }
  // a little music note doodled beside the word
  const np = clamp((lt - 0.62) / 0.3);
  if (np > 0) {
    const nx = lay.x0 + lay.width + 0.05 * H, ny = lay.top + 0.02 * H, u = 0.07 * H;
    F.save(); F.lineWidth = 0.014 * H; F.lineCap = 'round'; F.lineJoin = 'round';
    F.setLineDash([u * 6 * np, u * 6]);
    F.beginPath(); F.ellipse(nx, ny + u * 2.2, u * 0.5, u * 0.36, -0.4, 0, TAU);
    F.moveTo(nx + u * 0.45, ny + u * 2.1); F.lineTo(nx + u * 0.45, ny); F.quadraticCurveTo(nx + u * 1.1, ny + u * 0.4, nx + u * 1.0, ny + u * 1.0);
    F.stroke(); F.restore();
  }
  // "that" and the tail, wiped with a fingertip
  const wipeText = (text, f, x, y, t0, dur) => {
    const p = clamp((lt - t0) / dur);
    if (p <= 0) return;
    const w = textWidth(F, text, f);
    F.save(); F.beginPath(); F.rect(x - 6, y - 0.2 * H, (w + 12) * p, 0.3 * H); F.clip();
    F.font = f; F.globalAlpha = 0.95; F.fillText(text, x, y); F.restore();
  };
  const fThat = font('serifIt', lay.thatSize), fTail = font('serifIt', lay.tailSize);
  wipeText('that', fThat, lay.thatX, lay.thatBase, 0.04, 0.12);
  const tail = COPY.lines[1].tail;
  const tw = textWidth(F, tail, fTail);
  wipeText(tail, fTail, lay.x0 + lay.width - tw, lay.tailBase, 0.5, 0.42);
  F.globalCompositeOperation = 'source-over';
  F.globalAlpha = 1;
  L.drawImage(fogCanvas, 0, 0);
  // warm light bloom from above
  G.globalAlpha = 0.25; G.drawImage(glowDot(128, [255, 230, 190]), W * 0.1, -H * 0.6, W * 0.5, H); G.globalAlpha = 1;
  // lights out
  const off = seg(lt, 2.28, 2.34);
  if (off > 0) { L.fillStyle = `rgba(0,0,0,${off})`; L.fillRect(0, 0, W, H); }
}

// ---- 03 STORY — the last lit window at 2 AM ------------------------------------

const BLD = (() => {
  const r = mulberry32(2020);
  const cols = 11, rows = 6, keep = 2 * cols + 7;
  const wins = [];
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const v = r();
    wins.push({ i, j, kind: v < 0.72 ? 'warm' : v < 0.88 ? 'tv' : 'dark', rank: r(), ac: r() < 0.25, rail: r() < 0.35 });
  }
  wins[keep].kind = 'warm';
  const order = wins.map((w, k) => [w.rank, k]).sort((a, b) => a[0] - b[0]).map(([, k]) => k).filter((k) => k !== keep);
  order.forEach((k, n) => { wins[k].off = 0.05 + (n / order.length) * 0.58; });
  wins[keep].off = Infinity;
  return { cols, rows, keep, wins };
})();

function buildingGeom(K) {
  const { W, H } = K;
  const p = portraitOf(K);
  const top = (p ? 0.3 : 0.2) * H;
  const cw = W / (BLD.cols + 0.6), ww = cw * 0.64;
  const rh = (H - top) / (BLD.rows + 0.3), wh = rh * 0.56;
  return { top, cw, ww, rh, wh, x0: cw * 0.3 + (cw - ww) / 2, y0: top + rh * 0.3 };
}

function sceneStory(K, lt, t) {
  const { L, G, W, H } = K;
  const B = buildingGeom(K);
  const kw = BLD.wins[BLD.keep];
  const kx = B.x0 + kw.i * B.cw, ky = B.y0 + kw.j * B.rh;
  const z = ease.inOutCubic(seg(lt, 0.7, 1.02));
  const target = portraitOf(K) ? 0.94 * W / B.ww : Math.min(0.84 * W / B.ww, 0.76 * H / B.wh);
  const s = Math.exp(lerp(0, Math.log(target), z)) * (1 + 0.03 * seg(lt, 1.0, 2.4));
  const P = [kx + B.ww / 2, ky + B.wh / 2];
  const Q = [lerp(P[0], W / 2, z), lerp(P[1], (portraitOf(K) ? 0.62 : 0.5) * H, z)];
  setView(K, zoomM(P, Q, s));
  // sky
  const sg = L.createLinearGradient(0, 0, 0, H);
  sg.addColorStop(0, '#03041A'); sg.addColorStop(1, '#141A4A');
  L.fillStyle = sg; L.fillRect(-W, -H, 3 * W, 3 * H);
  for (const st of STARS) {
    L.globalAlpha = (0.35 + 0.65 * Math.pow(0.5 + 0.5 * Math.sin(t * 5 + st.ph), 2)) * 0.8;
    L.fillStyle = '#FFFFFF';
    L.beginPath(); L.arc(st.x * W, st.y * B.top, st.s * 0.0016 * H + 0.5, 0, TAU); L.fill();
  }
  L.globalAlpha = 1;
  // roofline: water tank and a dish antenna
  L.fillStyle = '#0E1128';
  L.fillRect(0.16 * W, B.top - 0.07 * H, 0.07 * W, 0.07 * H);
  L.beginPath(); L.ellipse(0.195 * W, B.top - 0.07 * H, 0.035 * W, 0.012 * H, 0, 0, TAU); L.fill();
  L.fillRect(0.2 * W, B.top - 0.095 * H, 0.003 * W, 0.03 * H);
  L.beginPath(); L.ellipse(0.74 * W, B.top - 0.035 * H, 0.02 * W, 0.028 * H, -0.6, 0, TAU); L.fill();
  L.fillRect(0.738 * W, B.top - 0.03 * H, 0.004 * W, 0.03 * H);
  // facade
  const fg = L.createLinearGradient(0, B.top, 0, H);
  fg.addColorStop(0, '#1A1F3E'); fg.addColorStop(1, '#0D1028');
  L.fillStyle = fg; L.fillRect(-0.01 * W, B.top, 1.02 * W, H - B.top + 2);
  L.fillStyle = 'rgba(0,0,0,0.25)';
  for (let j = 0; j <= BLD.rows; j++) L.fillRect(0, B.y0 - B.rh * 0.22 + j * B.rh, W, B.rh * 0.05);
  for (const w of BLD.wins) {
    const x = B.x0 + w.i * B.cw, y = B.y0 + w.j * B.rh;
    let on = w.kind === 'dark' ? 0 : 1;
    const a = lt - w.off;
    if (a > 0) on = a < 0.05 ? (Math.floor(a * 120) % 2 ? 0.4 : 0) : 0;
    if (on > 0) {
      const wg = L.createLinearGradient(0, y, 0, y + B.wh);
      if (w.kind === 'tv') { wg.addColorStop(0, '#9CC0FF'); wg.addColorStop(1, '#4E6DD8'); }
      else { wg.addColorStop(0, '#FFE2A0'); wg.addColorStop(1, '#FF9A45'); }
      L.globalAlpha = on;
      L.fillStyle = wg; L.fillRect(x, y, B.ww, B.wh);
      // curtains
      L.fillStyle = w.kind === 'tv' ? 'rgba(30,40,110,0.35)' : 'rgba(190,70,40,0.55)';
      L.fillRect(x, y, B.ww * 0.13, B.wh); L.fillRect(x + B.ww * 0.87, y, B.ww * 0.13, B.wh);
      L.fillStyle = 'rgba(120,30,15,0.25)';
      for (let k = 0; k < 3; k++) { L.fillRect(x + B.ww * (0.02 + k * 0.04), y, B.ww * 0.012, B.wh); L.fillRect(x + B.ww * (0.89 + k * 0.035), y, B.ww * 0.01, B.wh); }
      L.globalAlpha = 1;
      G.globalAlpha = 0.18 * on;
      G.drawImage(glowDot(64, w.kind === 'tv' ? [120, 150, 255] : [255, 170, 90]), x - B.ww * 0.3, y - B.wh * 0.4, B.ww * 1.6, B.wh * 1.8);
      G.globalAlpha = 1;
    } else {
      L.fillStyle = '#070918'; L.fillRect(x, y, B.ww, B.wh);
    }
    L.fillStyle = '#0A0C20';
    L.fillRect(x - B.ww * 0.03, y - B.wh * 0.03, B.ww * 1.06, B.wh * 0.03);
    if (w !== kw || z < 0.3) { L.globalAlpha = w === kw ? 1 - z / 0.3 : 1; L.fillRect(x + B.ww * 0.49, y, B.ww * 0.02, B.wh); L.globalAlpha = 1; }
    if (w.ac && w !== kw) { L.fillStyle = '#2A2F4A'; L.fillRect(x + B.ww * 0.62, y + B.wh * 0.78, B.ww * 0.34, B.wh * 0.26); }
    if (w.rail) { L.fillStyle = '#0A0C1E'; L.fillRect(x - B.ww * 0.05, y + B.wh * 0.72, B.ww * 1.1, B.wh * 0.04); for (let k = 0; k < 7; k++) L.fillRect(x - B.ww * 0.05 + k * B.ww * 0.18, y + B.wh * 0.72, B.ww * 0.015, B.wh * 0.28); }
  }
  setView(K, IDENT);
  // clock
  const ca = 1 - z;
  if (ca > 0.01) {
    const dh = 0.09 * H, flip = lt > 0.66;
    const digits = flip ? [0, 2, ':', 0, 0] : [0, 1, ':', 5, 9];
    let x = W / 2 - dh * 1.3;
    L.save(); L.globalAlpha = ca;
    for (const d of digits) {
      if (d === ':') { L.fillStyle = '#FF3A1F'; for (const cy of [0.33, 0.67]) { L.beginPath(); L.arc(x + dh * 0.08, 0.06 * H + dh * cy, dh * 0.045, 0, TAU); L.fill(); } x += dh * 0.22; continue; }
      sevenSeg(L, d, x, 0.06 * H, dh, '#FF3A1F'); x += dh * 0.62;
    }
    L.restore();
  }
  // the story, told in the last lit window
  if (lt > 0.85) {
    const winW = B.ww * s;
    const lay = keyLayout(K, 'STORY', 'center', { cy: portraitOf(K) ? 0.58 : 0.47, targetW: Math.min(0.56, (winW / W) * 0.66), cap: 0.24 * H, pCap: 0.08 * H, pY: 0.56, pTargetW: Math.min(0.84, (winW / W) * 0.72) });
    if (portraitOf(K)) { lay.baseline = 0.6 * H + lay.capPx / 2; lay.top = lay.baseline - lay.capPx; lay.thatBase = lay.top - 0.035 * lay.U; lay.tailBase = lay.baseline + 0.105 * lay.U; }
    const lt2 = lt - 0.85;
    drawKey(L, lay, 'STORY', '#1C1209', (ch) => {
      const p = ease.snap(clamp((lt2 - ch.i * 0.04) / 0.3));
      return p > 0 ? { a: p, dy: (1 - p) * lay.capPx * 0.35 } : null;
    });
    textBlock(K, lay, lt2, COPY.lines[2].tail, { sub: '#1C1209', accent: '#B8200C' }, { that: 0.05, tailT: 0.2 });
  }
  const off = seg(lt, 2.28, 2.33);
  if (off > 0) { L.fillStyle = `rgba(0,0,0,${off})`; L.fillRect(0, 0, W, H); }
}

// ---- 04 JOKE — the group chat that never lets it go -------------------------------

const MSGS = [
  { t: 0.02, who: 'Aditi', col: '#FF9466', quote: 'the maggi at 3 AM story', text: 'STILL not over this' },
  { t: 0.2, who: 'Rohan', col: '#7FD1FF', text: 'HAHAHAHAHAHA' },
  { t: 0.36, who: 'Meera', col: '#F7A8FF', text: 'i literally cannot breathe' },
  { t: 0.52, who: 'Sam', col: '#9BF08A', quote: '“bhaiya, ek aur plate”', text: 'ICONIC' },
  { t: 0.7, who: 'Dev', col: '#FFD36B', text: 'tell it again at the reunion' },
  { t: 0.95, me: true, text: 'someone put this on a stage' },
];

function chatGeom(K) {
  const { W, H } = K;
  if (portraitOf(K)) return { x: 0.06 * W, y: 0.44 * H, w: 0.88 * W, h: 0.52 * H, u: 0.024 * W * 1.4 };
  return { x: 0.58 * W, y: 0.06 * H, w: 0.37 * W, h: 0.88 * H, u: 0.024 * H };
}

function laughFace(ctx, x, y, r) {
  ctx.save();
  ctx.fillStyle = '#FFC93C'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#6B3A00'; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x - r * 0.38, y - r * 0.18, r * 0.18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + r * 0.38, y - r * 0.18, r * 0.18, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
  ctx.fillStyle = '#6B3A00'; ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + r * 0.1); ctx.quadraticCurveTo(x, y + r * 0.95, x + r * 0.55, y + r * 0.1); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7FD1FF'; ctx.beginPath(); ctx.ellipse(x - r * 0.78, y + r * 0.05, r * 0.14, r * 0.26, 0.3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + r * 0.78, y + r * 0.05, r * 0.14, r * 0.26, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
}

/** Lays out and draws the chat; returns the rect of the last ("me") bubble. */
function drawChat(K, lt) {
  const { L } = K;
  const Cg = chatGeom(K);
  const u = Cg.u;
  const on = ease.outCubic(clamp(lt / 0.12));
  L.save();
  L.globalAlpha = on;
  L.fillStyle = '#12151A';
  L.beginPath(); L.roundRect(Cg.x, Cg.y, Cg.w, Cg.h, u * 1.2); L.fill();
  // header
  const hh = u * 3.6;
  L.fillStyle = '#191D24'; L.beginPath(); L.roundRect(Cg.x, Cg.y, Cg.w, hh, [u * 1.2, u * 1.2, 0, 0]); L.fill();
  L.fillStyle = C.red; L.beginPath(); L.arc(Cg.x + u * 2, Cg.y + hh / 2, u * 1.1, 0, TAU); L.fill();
  L.fillStyle = '#fff'; L.font = font('mona', u * 1.1, 800); L.textAlign = 'center'; L.textBaseline = 'middle';
  L.fillText('B', Cg.x + u * 2, Cg.y + hh / 2 + u * 0.05);
  L.textAlign = 'left';
  L.fillStyle = '#F2F2F2'; L.font = font('mona', u * 1.0, 700);
  L.fillText('B-Wing, 3rd floor', Cg.x + u * 3.7, Cg.y + hh * 0.36);
  L.fillStyle = lt > 0.6 ? '#7DE08A' : '#8A919C'; L.font = font('mona', u * 0.72, 500);
  L.fillText(lt > 0.6 && lt < 0.95 ? 'Dev is typing…' : 'Aditi, Dev, Meera, Rohan, Sam +9', Cg.x + u * 3.7, Cg.y + hh * 0.7);
  L.textBaseline = 'alphabetic';
  // input bar
  const ib = u * 2.4;
  L.fillStyle = '#1D2128'; L.beginPath(); L.roundRect(Cg.x + u * 0.8, Cg.y + Cg.h - ib - u * 0.8, Cg.w - u * 1.6, ib, ib / 2); L.fill();
  L.fillStyle = '#6C737E'; L.font = font('mona', u * 0.85, 450);
  L.fillText('Message', Cg.x + u * 1.8, Cg.y + Cg.h - ib / 2 - u * 0.8 + u * 0.3);
  // messages, stacked from the bottom
  L.save();
  L.beginPath(); L.rect(Cg.x, Cg.y + hh, Cg.w, Cg.h - hh - ib - u * 1.2); L.clip();
  const fText = font('mona', u * 0.98, 520), fName = font('mona', u * 0.74, 720), fQuote = font('serifIt', u * 0.9);
  const heights = MSGS.map((m) => u * (m.me ? 2.3 : 3.2) + (m.quote ? u * 2.0 : 0));
  const gap = u * 0.6;
  let y = Cg.y + Cg.h - ib - u * 1.6;
  let meRect = null;
  for (let k = MSGS.length - 1; k >= 0; k--) {
    const m = MSGS[k];
    const a = lt - m.t;
    if (a < 0) continue;
    const grow = ease.outCubic(clamp(a / 0.16));
    const h = heights[k];
    y -= (h + gap) * grow;
    const tw = textWidth(L, m.text, fText);
    const bw = Math.min(Cg.w * 0.8, Math.max(tw, m.quote ? textWidth(L, m.quote, fQuote) + u * 1.4 : 0, m.me ? 0 : textWidth(L, m.who, fName)) + u * 2);
    const bx = m.me ? Cg.x + Cg.w - u * 0.9 - bw : Cg.x + u * 0.9;
    const sp = spring(a, 2.6, 9);
    L.save();
    const ox = m.me ? bx + bw : bx, oy = y + h;
    L.translate(ox, oy); L.scale(sp, sp); L.translate(-ox, -oy);
    L.fillStyle = m.me ? '#B3200D' : '#20252D';
    L.beginPath(); L.roundRect(bx, y, bw, h, u * 0.9); L.fill();
    let ty = y + u * 1.25;
    if (!m.me) { L.fillStyle = m.col; L.font = fName; L.fillText(m.who, bx + u, ty); ty += u * 1.25; }
    if (m.quote) {
      L.fillStyle = 'rgba(255,255,255,0.06)'; L.fillRect(bx + u * 0.7, ty - u * 0.7, bw - u * 1.4, u * 1.6);
      L.fillStyle = m.col; L.fillRect(bx + u * 0.7, ty - u * 0.7, u * 0.22, u * 1.6);
      L.fillStyle = '#B9C0CA'; L.font = fQuote; L.fillText(m.quote, bx + u * 1.2, ty + u * 0.32);
      ty += u * 2.0;
    }
    L.fillStyle = '#F5F5F5'; L.font = fText; L.fillText(m.text, bx + u, ty + (m.me ? -u * 0.25 : 0) + u * 0.25);
    L.restore();
    if (m.me) meRect = { x: bx, y, w: bw, h };
  }
  L.restore();
  // reaction pill on the last message
  if (meRect && lt > 1.15) {
    const p = spring(lt - 1.15, 2.4, 8);
    const n = Math.round(lerp(12, 47, clamp((lt - 1.15) / 0.5)));
    const pw = u * 4.2, ph = u * 1.8, px = meRect.x + meRect.w - pw * 0.9, py = meRect.y + meRect.h - ph * 0.35;
    L.save(); L.translate(px + pw / 2, py + ph / 2); L.scale(p, p); L.translate(-(px + pw / 2), -(py + ph / 2));
    L.fillStyle = '#2A2F38'; L.beginPath(); L.roundRect(px, py, pw, ph, ph / 2); L.fill();
    L.strokeStyle = '#12151A'; L.lineWidth = u * 0.25; L.stroke();
    laughFace(L, px + ph * 0.55, py + ph / 2, ph * 0.34);
    L.fillStyle = '#EDEDED'; L.font = font('mona', u * 0.9, 700); L.fillText(String(n), px + ph * 1.05, py + ph * 0.68);
    L.restore();
  }
  L.restore();
  return meRect;
}

const HAS = Array.from({ length: 14 }, (_, i) => { const r = mulberry32(4100 + i); return { t0: 0.45 + i * 0.1 + r() * 0.05, x: r(), rot: (r() - 0.5) * 0.6, s: 0.7 + r() * 0.6 }; });

function sceneJoke(K, lt, t, doodle = true) {
  const { L, W, H } = K;
  L.fillStyle = '#0B0D11'; L.fillRect(0, 0, W, H);
  if (doodle) {
    L.save(); L.strokeStyle = 'rgba(255,255,255,0.04)'; L.lineWidth = Math.max(1, 0.002 * H);
    const r = mulberry32(77);
    for (let i = 0; i < 60; i++) {
      const x = r() * W, y = r() * H - (lt * 0.02 * H), s = (0.015 + r() * 0.02) * H;
      L.beginPath();
      if (i % 3 === 0) L.arc(x, y, s, 0, TAU); else if (i % 3 === 1) { L.moveTo(x - s, y); L.lineTo(x + s, y); L.moveTo(x, y - s); L.lineTo(x, y + s); } else { L.moveTo(x - s, y); L.quadraticCurveTo(x, y - s, x + s, y); }
      L.stroke();
    }
    L.restore();
  }
  const me = drawChat(K, lt);
  const lay = keyLayout(K, 'JOKE', 'left', { cy: 0.47, targetW: 0.44 });
  const laughOn = smoothstep(0.35, 0.5, lt);
  drawKey(L, lay, 'JOKE', C.cream, (ch) => {
    const a = lt - 0.03 - ch.i * 0.05;
    if (a <= 0) return null;
    const s = spring(a, 2.6, 7.5);
    const laugh = 0.04 * Math.sin(t * 40 + ch.i * 2.1) * laughOn;
    return { a: 1, s, rot: (hash1(ch.i + 40) - 0.5) * 0.12 + laugh + (1 - clamp(a / 0.3)) * (ch.i % 2 ? 0.3 : -0.3), dy: -Math.abs(Math.sin(t * 20 + ch.i)) * 0.012 * H * laughOn };
  });
  // little bursts of "ha" rising off the word
  const fHa = font('serifIt', 0.045 * lay.U);
  L.save(); L.font = fHa; L.fillStyle = C.cream;
  for (const h of HAS) {
    const a = lt - h.t0;
    if (a < 0 || a > 0.9) continue;
    const k = a / 0.9;
    L.globalAlpha = Math.sin(Math.PI * k) * 0.7;
    L.save(); L.translate(lay.x0 + (0.3 + 0.7 * h.x) * lay.width, lay.top - 0.03 * H - k * 0.14 * H); L.rotate(h.rot); L.scale(h.s, h.s);
    L.fillText('ha', 0, 0); L.restore();
  }
  L.restore();
  textBlock(K, lay, lt, COPY.lines[3].tail, { sub: C.cream, accent: C.red }, { tailT: 0.4 });
  return me;
}

// ---- 05 MIX — the record the neighbours know by heart ---------------------------

function mixRecord(K) {
  const { W, H } = K;
  if (portraitOf(K)) return { R: 0.5 * W, cx: W * 0.5, cy: H * 0.8 };
  return { R: 0.6 * H, cx: 0.8 * W, cy: 0.52 * H };
}

let eqCanvas = null;
function eqBuffer(W, H) {
  if (!eqCanvas || eqCanvas.width !== W || eqCanvas.height !== H) { eqCanvas = document.createElement('canvas'); eqCanvas.width = W; eqCanvas.height = H; }
  return eqCanvas.getContext('2d');
}

function sceneMix(K, lt, t) {
  const { L, S, W, H } = K;
  L.fillStyle = C.red; L.fillRect(0, 0, W, H);
  const { R, cx, cy } = mixRecord(K);
  // sound through the wall: rings on every beat
  for (let k = 0; k < 4; k++) {
    const b = (t - T.drop) / (60 / 100);
    const a = (b - Math.floor(b) + k) * 0.6;
    L.strokeStyle = `rgba(255,230,210,${0.12 * Math.max(0, 1 - a / 2.4)})`;
    L.lineWidth = 0.004 * H;
    L.beginPath(); L.arc(cx, cy, R * (1.02 + a * 0.35), 0, TAU); L.stroke();
  }
  const v = vinylCanvas(Math.round(R));
  const intro = ease.outExpo(clamp(lt / 0.24));
  L.save(); L.translate(cx, cy); L.rotate(lt * 5.5 - (1 - intro) * 2.5); L.scale(intro, intro); L.drawImage(v.c, -v.R, -v.R); L.restore();
  // tonearm
  if (!portraitOf(K)) {
    const px = cx + R * 0.92, py = cy - R * 0.92;
    const ang = 2.25 + 0.05 * Math.sin(t * 2) - (1 - intro) * 0.5;
    L.save(); L.translate(px, py);
    L.fillStyle = '#E9E3D8'; L.beginPath(); L.arc(0, 0, R * 0.07, 0, TAU); L.fill();
    L.rotate(ang); L.fillStyle = '#D9D2C6'; L.fillRect(0, -R * 0.012, R * 0.95, R * 0.024);
    L.fillStyle = '#2A2A2E'; L.fillRect(R * 0.9, -R * 0.035, R * 0.12, R * 0.07);
    L.restore();
  }
  // MIX, built out of equaliser bars
  const lay = keyLayout(K, 'MIX', 'left', { cy: 0.47, targetW: 0.42 });
  const appear = ease.snap(clamp((lt - 0.03) / 0.16));
  if (appear > 0) {
    const f = font('mona', lay.size, 900, lay.wdth);
    L.save(); L.globalAlpha = 0.3 * appear; L.font = f; L.fillStyle = C.cream; L.fillText('MIX', lay.x0, lay.baseline); L.restore();
    const E = eqBuffer(W, H);
    E.setTransform(1, 0, 0, 1, 0, 0); E.globalCompositeOperation = 'source-over'; E.clearRect(0, 0, W, H);
    const n = 30, bw = lay.width / n;
    E.fillStyle = C.cream;
    for (let i = 0; i < n; i++) {
      const hgt = clamp(0.55 + 0.3 * beatEnv(t, 5) * (1 - i / n * 0.4) + 0.25 * (noise1(i * 0.7 + t * 7) - 0.3), 0.35, 1) * appear;
      E.fillRect(lay.x0 + i * bw + bw * 0.12, lay.baseline - lay.capPx * 1.05 * hgt, bw * 0.76, lay.capPx * 1.05 * hgt + 2);
    }
    E.globalCompositeOperation = 'destination-in';
    E.font = f; E.fillText('MIX', lay.x0, lay.baseline);
    L.drawImage(eqCanvas, 0, 0);
  }
  textBlock(K, lay, lt, COPY.lines[4].tail, { sub: C.cream, accent: C.ink }, { tailT: 0.36 });
  // the neighbour's sticky note
  const na = lt - 0.9;
  if (na > 0) {
    const p = ease.outBack(clamp(na / 0.2), 2.4);
    const ns = (portraitOf(K) ? 0.24 * W : 0.25 * H);
    const nx = portraitOf(K) ? 0.62 * W : 0.535 * W, ny = portraitOf(K) ? 0.5 * H : 0.08 * H;
    const rot = 0.09 - (1 - p) * 0.2;
    S.save(); S.globalAlpha = 0.5; S.fillStyle = '#420600'; S.translate(nx + ns * 0.5 + 0.01 * H, ny + ns * 0.5 + 0.015 * H); S.rotate(rot); S.fillRect(-ns / 2, -ns / 2, ns, ns); S.restore();
    L.save();
    L.translate(nx + ns / 2, ny + ns / 2); L.rotate(rot); L.scale(lerp(1.4, 1, p), lerp(1.4, 1, p));
    const ng = L.createLinearGradient(0, -ns / 2, 0, ns / 2);
    ng.addColorStop(0, '#FFE680'); ng.addColorStop(1, '#F5CF4A');
    L.fillStyle = ng; L.fillRect(-ns / 2, -ns / 2, ns, ns);
    L.fillStyle = 'rgba(255,255,255,0.35)'; L.fillRect(-ns * 0.18, -ns / 2 - ns * 0.05, ns * 0.36, ns * 0.12);
    L.fillStyle = '#2B2014';
    const f1 = font('serifIt', ns * 0.16), f2 = font('serifIt', ns * 0.115);
    L.font = f1; L.fillText('it’s 1 AM.', -ns * 0.4, -ns * 0.18);
    L.fillText('please.', -ns * 0.4, ns * 0.02);
    L.font = f2; L.fillText('(also… what song', -ns * 0.4, ns * 0.22); L.fillText('is this?)', -ns * 0.4, ns * 0.36);
    L.restore();
  }
}

// ---------------------------------------------------------------------------

export function fastImpulses() {
  const list = T.lines.slice(1).map((t0) => [t0, 0.4, 11, 9]);
  const [w1, w2, w3, w4] = T.climaxWords;
  list.push([w1, 0.35, 12, 10], [w2, 0.35, 12, 10], [w3, 0.35, 12, 10], [w4, 1.3, 8, 6], [T.lines[4] + 0.9, 0.25, 10, 10]);
  return list;
}

export function drawFast(K, t, post) {
  const { W, H } = K;
  if (t >= T.climax) {
    if (t < T.endHit + 0.02) sceneClimax(K, t, post);
    drawHUD(K, t, 5, C.cream);
    return;
  }
  const i = lineAt(t);
  const lt = t - T.lines[i];
  if (i === 0) scenePoem(K, lt, t);
  else if (i === 1) sceneSong(K, lt, t);
  else if (i === 2) sceneStory(K, lt, t);
  else if (i === 3) {
    const ex = seg(lt, 2.16, 2.4);
    if (ex > 0) {
      // fly into "someone put this on a stage" until the screen is red
      const me = sceneJoke(K, 2.16, T.lines[3] + 2.16, false);
      K.L.fillStyle = '#0B0D11'; K.L.fillRect(0, 0, W, H);
      if (me) {
        const k = ease.inExpo(ex);
        const P = [me.x + me.w / 2, me.y + me.h / 2];
        setView(K, zoomM(P, [lerp(P[0], W / 2, k), lerp(P[1], H / 2, k)], Math.exp(k * Math.log(45))));
        sceneJoke(K, 2.16, T.lines[3] + 2.16, false);
        setView(K, IDENT);
      }
    } else sceneJoke(K, lt, t);
  } else {
    const ex = seg(lt, 2.14, 2.4);
    const muffle = 1 - seg(lt, 0.18, 0.3);
    if (ex > 0) {
      K.L.fillStyle = C.ink; K.L.fillRect(0, 0, W, H);
      const { cx, cy } = mixRecord(K);
      const P = [cx, cy];
      const k = ease.inExpo(clamp(ex / 0.9));
      setView(K, zoomM(P, [lerp(P[0], W / 2, k), lerp(P[1], H / 2, k)], Math.exp(k * Math.log(60))));
    }
    sceneMix(K, lt, t);
    setView(K, IDENT);
    if (muffle > 0.01) post.exposure *= lerp(1, 0.6, muffle);
  }
  const hudColor = i === 1 ? '#10403F' : i === 2 && lt > 0.9 ? '#1C1209' : C.cream;
  drawHUD(K, t, i, hudColor, i === 1 ? 1 - seg(lt, 2.26, 2.34) : 1);
}
