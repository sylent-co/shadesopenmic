// Font loading with continuous variable-font axes for canvas text.
// Canvas has no font-variation-settings, but a FontFace whose descriptors pin a
// single weight/stretch value renders the variable font at exactly that
// instance. Faces are created lazily (ArrayBuffer sources load synchronously).

const buffers = new Map();
const faces = new Map();

export async function loadFontFiles(files) {
  await Promise.all(
    Object.entries(files).map(async ([key, src]) => {
      const buf = src instanceof ArrayBuffer ? src : await (await fetch(src)).arrayBuffer();
      buffers.set(key, buf);
    }),
  );
}

/**
 * Returns a quoted CSS family name for `key` at the given axis values.
 * wdth is quantised to 1%, wght to 10 units.
 */
export function face(key, wght = 400, wdth = 100) {
  const g = Math.round(wght / 10) * 10;
  const w = Math.round(wdth);
  const name = `${key}_${g}_${w}`;
  if (!faces.has(name)) {
    const buf = buffers.get(key);
    if (!buf) throw new Error(`font ${key} not loaded`);
    const f = new FontFace(name, buf, { weight: String(g), stretch: `${w}%` });
    document.fonts.add(f);
    f.load();
    faces.set(name, f);
  }
  return `"${name}"`;
}

/** Build a canvas font shorthand string. */
export const font = (key, size, wght = 400, wdth = 100) => `${size.toFixed(2)}px ${face(key, wght, wdth)}`;

export const fontsReady = () => document.fonts.ready;
