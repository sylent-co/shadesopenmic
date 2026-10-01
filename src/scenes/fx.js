// Shared 2D effect helpers: glow sprites, blur-by-crossfade glyphs, rich text.

import { clamp } from '../core/math.js';
import { font } from '../core/fonts.js';
import { layout } from './text.js';

export const SOFT_MAX = 16; // px of blur represented by the soft layer

const sprites = new Map();

/** Radial glow sprite; tint is [r, g, b] (0-255) for the halo. */
export function glowDot(size = 64, tint = [255, 200, 140]) {
  const key = size + ':' + tint.join(',');
  if (sprites.has(key)) return sprites.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const [r, g, b] = tint;
  const gr = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.15, `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},0.8)`);
  gr.addColorStop(0.45, `rgba(${r},${g},${b},0.18)`);
  gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, size, size);
  sprites.set(key, c);
  return c;
}

/** Glyph with apparent blur: crossfade the sharp layer (L) into the soft layer (S). */
export function blurGlyph(K, g, x, y, rot, alpha, blur, color, fontStr, halo = 0, scale = 1, shadow = 0) {
  const k = clamp(blur / SOFT_MAX);
  if (shadow > 0) {
    // soft dark bed behind the glyph (lives in the blurred layer)
    const S = K.S;
    S.save(); S.font = fontStr; S.translate(x, y + 2); if (rot) S.rotate(rot); if (scale !== 1) S.scale(scale, scale);
    S.globalAlpha = Math.min(1, alpha * shadow); S.fillStyle = '#140A12'; S.fillText(g.ch, -g.w / 2, 0); S.restore();
  }
  for (const [ctx, a] of [[K.L, alpha * (1 - k)], [K.S, alpha * (k + halo)]]) {
    if (a <= 0.003) continue;
    ctx.save();
    ctx.font = fontStr;
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (scale !== 1) ctx.scale(scale, scale);
    ctx.globalAlpha = Math.min(1, a);
    ctx.fillStyle = color;
    ctx.fillText(g.ch, -g.w / 2, 0);
    ctx.restore();
  }
}

export const STYLE = {
  r: { key: 'serif', color: '#F4EDE0' },
  i: { key: 'serifIt', color: '#FFDDB0' },
  d: { key: 'serif', color: '#FF4F2E' },
};

/**
 * Lay out lines of [text, style] segments. Returns glyphs with centre x,
 * baseline y, line index and running index.
 */
export function richGlyphs(ctx, lines, size, { x0, y0, align = 'left', lineGap = 1.14, styles = STYLE }) {
  const glyphs = [];
  let idx = 0;
  let maxW = 0;
  lines.forEach((segs, li) => {
    let lx = 0;
    const row = [];
    for (const [text, st] of segs) {
      const s = styles[st];
      const f = font(s.key, size * (s.k || 1));
      const l = layout(ctx, text, f);
      for (const c of l.chars) row.push({ ...c, x: lx + c.x, font: f, color: s.color, style: st });
      lx += l.width;
    }
    maxW = Math.max(maxW, lx);
    const off = align === 'center' ? -lx / 2 : 0;
    for (const g of row) glyphs.push({ ...g, cx: x0 + off + g.x + g.w / 2, y: y0 + li * size * lineGap, line: li, idx: idx++ });
  });
  return { glyphs, width: maxW, count: idx };
}
