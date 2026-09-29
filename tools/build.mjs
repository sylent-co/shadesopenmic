// Single-file build: bundles the JS with esbuild and inlines subset fonts, so
// dist/SHADES-OpenMic-Trailer.html plays by double-clicking (no server).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });

const FONTS = {
  mona: 'MonaSans-VF.ttf',
  serif: 'InstrumentSerif-Regular.ttf',
  serifIt: 'InstrumentSerif-Italic.ttf',
  mono: 'JetBrainsMono-VF.ttf',
};
// Basic Latin + the few typographic extras the trailer uses
const UNICODES = 'U+0020-007E,U+00A0,U+00B0,U+00B7,U+2014,U+2019,U+2022,U+2026';
const PY = process.env.PYFTSUBSET || 'pyftsubset';
const tmp = fs.mkdtempSync(path.join(root, '.build-'));
const fontB64 = {};
// Mona Sans has a Reserved Font Name, so it ships unmodified (OFL §3); the
// others are subset to keep the single file small.
const KEEP_WHOLE = new Set(['mona']);
for (const [key, file] of Object.entries(FONTS)) {
  const src = path.join(root, 'assets/fonts', file);
  if (KEEP_WHOLE.has(key)) { fontB64[key] = fs.readFileSync(src).toString('base64'); continue; }
  const out = path.join(tmp, file.replace('.ttf', '.subset.ttf'));
  const r = spawnSync(PY, [src, `--unicodes=${UNICODES}`, `--output-file=${out}`, '--layout-features=*', '--no-hinting', '--desubroutinize'], { stdio: 'inherit' });
  const used = r.status === 0 && fs.existsSync(out) ? out : src;
  if (used === src) console.warn(`pyftsubset unavailable for ${file}; embedding full font`);
  fontB64[key] = fs.readFileSync(used).toString('base64');
}
fs.rmSync(tmp, { recursive: true, force: true });

const bundle = await build({
  entryPoints: [path.join(root, 'src/standalone.js')], bundle: true, format: 'iife', minify: true,
  target: ['es2020'], write: false, legalComments: 'none',
});
const js = bundle.outputFiles[0].text;
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const start = html.indexOf('<script type="module">');
const end = html.indexOf('</script>', start) + '</script>'.length;
const inline = `<script>window.__FONT_B64__=${JSON.stringify(fontB64)};</script>\n<script>${js.replace(/<\/script/g, '<\\/script')}</script>`;
html = html.slice(0, start) + inline + html.slice(end);
const outFile = path.join(dist, 'SHADES-OpenMic-Trailer.html');
fs.writeFileSync(outFile, html);
console.log(`wrote ${path.relative(root, outFile)} (${(fs.statSync(outFile).size / 1024).toFixed(0)} KB)`);
