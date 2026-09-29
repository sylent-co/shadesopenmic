// SHADES logo: vector mark (traced from the supplied artwork, circle radius 1,
// y down) plus a brand-disc renderer matching the shader colour model.
import MARK_PATH from './markPath.js';

let markPath2D = null;
export const markPath = () => (markPath2D ||= new Path2D(MARK_PATH));
export const MARK_D = MARK_PATH;

const cache = new Map();

/** Brand disc (with optional mark) rendered per-pixel into a canvas of `size`. */
export function brandDiscCanvas(size, withMark = true) {
  const key = size + ':' + withMark;
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  const d = img.data;
  const R = size / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const x = (px + 0.5 - R) / R, yDown = (py + 0.5 - R) / R;
      const y = -yDown;
      const r = Math.hypot(x, y);
      const aa = Math.min(1, Math.max(0, (1 - r) * R + 0.5));
      if (aa <= 0) continue;
      let base = y < 0 ? 200 - 30 * y : 200 - 115 * Math.pow(y, 1.1);
      base *= 1 - 0.45 * Math.pow(Math.abs(x), 1.5);
      const Rv = base / 255;
      let cr = Rv, cg = Rv * (0.10 + 0.06 * base / 230), cb = Rv * (0.02 + 0.045 * base / 230);
      const rim = Math.min(1, Math.max(0, (r - 0.945) / 0.04));
      const rs = rim * rim * (3 - 2 * rim) * 0.85;
      cr += (0.90 - cr) * rs; cg += (0.115 - cg) * rs; cb += (0.03 - cb) * rs;
      const i = (py * size + px) * 4;
      d[i] = Math.round(Math.min(1, cr) * 255);
      d[i + 1] = Math.round(Math.min(1, cg) * 255);
      d[i + 2] = Math.round(Math.min(1, cb) * 255);
      d[i + 3] = Math.round(aa * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  if (withMark) {
    ctx.save();
    ctx.translate(R, R);
    ctx.scale(R, R);
    ctx.fillStyle = '#fff';
    ctx.fill(markPath(), 'evenodd');
    ctx.restore();
  }
  cache.set(key, c);
  return c;
}

/** White mark on transparent, square, circle radius = size/2 (shader texture). */
export function markTextureCanvas(size = 2048) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.translate(size / 2, size / 2);
  ctx.scale(size / 2, size / 2);
  ctx.fillStyle = '#fff';
  ctx.fill(markPath(), 'evenodd');
  return c;
}

/** Draw the mark at centre (x, y) for a circle radius `r`. */
export function drawMark(ctx, x, y, r, color = '#fff') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(r, r);
  ctx.fillStyle = color;
  ctx.fill(markPath(), 'evenodd');
  ctx.restore();
}
