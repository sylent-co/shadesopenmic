// Typography helpers: kerning-aware per-character layout and drawing.
import { font } from '../core/fonts.js';

const metricCache = new Map();

/** Cap height & x-height ratios of a face (fraction of font size). */
export function metrics(ctx, key, wght = 400, wdth = 100) {
  const k = `${key}|${Math.round(wght / 10)}|${Math.round(wdth)}`;
  if (metricCache.has(k)) return metricCache.get(k);
  ctx.save();
  ctx.font = font(key, 200, wght, wdth);
  const H = ctx.measureText('H');
  const x = ctx.measureText('x');
  const m = { cap: H.actualBoundingBoxAscent / 200, xh: x.actualBoundingBoxAscent / 200 };
  ctx.restore();
  metricCache.set(k, m);
  return m;
}

/** Per-character x offsets (kerning preserved via prefix measurement). */
export function layout(ctx, text, fontStr, tracking = 0) {
  ctx.save();
  ctx.font = fontStr;
  ctx.letterSpacing = '0px';
  const chars = [...text];
  const out = [];
  let prefix = '';
  for (let i = 0; i < chars.length; i++) {
    const x = ctx.measureText(prefix).width + i * tracking;
    prefix += chars[i];
    const w = ctx.measureText(chars[i]).width;
    out.push({ ch: chars[i], x, w, i });
  }
  const width = ctx.measureText(prefix).width + (chars.length - 1) * tracking;
  ctx.restore();
  return { chars: out, width };
}

export function textWidth(ctx, text, fontStr, tracking = 0) {
  ctx.save();
  ctx.font = fontStr;
  ctx.letterSpacing = '0px';
  const w = ctx.measureText(text).width + Math.max(0, [...text].length - 1) * tracking;
  ctx.restore();
  return w;
}
