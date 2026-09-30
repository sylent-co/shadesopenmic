// Offline renderer: headless Chrome draws every frame deterministically
// (with temporal super-sampling for motion blur), the soundtrack is rendered
// by the same Web Audio code, and ffmpeg muxes the result.
//
//   node tools/render.mjs [--w=1920 --h=1080 --fps=60 --workers=2 --draft --name=landscape]

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startServer } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => { const m = a.match(/^--([\w-]+)(?:=(.*))?$/); return m ? [m[1], m[2] ?? true] : [a, true]; }));
const W = Number(args.w || 1920), H = Number(args.h || 1080), FPS = Number(args.fps || 60);
const DRAFT = !!args.draft;
const WORKERS = Number(args.workers || 2);
const NAME = args.name || `${W}x${H}_${FPS}${DRAFT ? '_draft' : ''}`;
const DURATION = Number(args.duration || 36.5);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const frameDir = path.join(root, 'frames', NAME);
const distDir = path.join(root, 'dist');
fs.mkdirSync(frameDir, { recursive: true });
fs.mkdirSync(distDir, { recursive: true });

// motion-blur samples per section (fast type needs the most)
const samplesAt = (t) => (DRAFT ? 1 : t < 12.0 ? 3 : t < 26.4 ? 6 : 3);

const CHROME = process.env.CHROME || '/usr/local/bin/google-chrome';
const launch = () => puppeteer.launch({
  executablePath: CHROME, headless: true, protocolTimeout: 600000,
  args: ['--no-sandbox', '--use-angle=gl-egl', '--use-gl=angle', '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
});

const server = await startServer(0, '127.0.0.1');
const port = server.address().port;

async function renderAudio() {
  const wavPath = path.join(distDir, 'soundtrack.wav');
  const browser = await launch();
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/tools/blank.html`);
  const res = await page.evaluate(async () => {
    const { renderSoundtrack, encodeWav } = await import('/src/audio/engine.js');
    const { buffer, report } = await renderSoundtrack();
    const wav = new Uint8Array(encodeWav(buffer));
    let bin = '';
    for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
    return { b64: btoa(bin), report };
  });
  fs.writeFileSync(wavPath, Buffer.from(res.b64, 'base64'));
  await browser.close();
  console.log('audio:', JSON.stringify(res.report));
  return wavPath;
}

async function worker(k, frames) {
  const browser = await launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log(`[w${k} pageerror]`, e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log(`[w${k}]`, m.text()); });
  await page.setViewport({ width: W, height: H });
  await page.goto(`http://127.0.0.1:${port}/index.html?render=1&w=${W}&h=${H}`);
  await page.waitForFunction('window.__INIT_DONE__ === true', { timeout: 120000 });
  let done = 0;
  const t0 = Date.now();
  for (const i of frames) {
    const file = path.join(frameDir, `f_${String(i).padStart(5, '0')}.png`);
    if (fs.existsSync(file) && fs.statSync(file).size > 1000) { done++; continue; }
    const t = i / FPS;
    const b64 = await page.evaluate((t, samples, fps) => {
      window.__TRAILER__.renderFrame(t, { samples, fps, shutter: 0.5 });
      return document.getElementById('stage').toDataURL('image/png').split(',')[1];
    }, t, samplesAt(t), FPS);
    fs.writeFileSync(file + '.tmp', Buffer.from(b64, 'base64'));
    fs.renameSync(file + '.tmp', file);
    done++;
    if (done % 30 === 0) {
      const rate = (Date.now() - t0) / done / 1000;
      console.log(`[w${k}] ${done}/${frames.length} frames, ${rate.toFixed(2)} s/frame, t=${t.toFixed(2)}`);
    }
  }
  await browser.close();
}

const total = Math.round(DURATION * FPS);
const all = Array.from({ length: total }, (_, i) => i);
const started = Date.now();
const [wav] = await Promise.all([
  args['skip-audio'] && fs.existsSync(path.join(distDir, 'soundtrack.wav')) ? path.join(distDir, 'soundtrack.wav') : renderAudio(),
  Promise.all(Array.from({ length: WORKERS }, (_, k) => worker(k, all.filter((i) => i % WORKERS === k)))),
]);
server.close();
console.log(`frames done in ${((Date.now() - started) / 60000).toFixed(1)} min`);

const out = path.join(distDir, args.out || `SHADES-OpenMic-Trailer-${NAME}.mp4`);
const ff = ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(frameDir, 'f_%05d.png'), '-i', wav,
  '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', DRAFT ? 'veryfast' : 'slow', '-crf', DRAFT ? '23' : '15', '-tune', 'film',
  '-pix_fmt', 'yuv420p', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
  '-vf', 'scale=out_color_matrix=bt709:out_range=tv',
  '-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-movflags', '+faststart', '-shortest', out];
const r = spawnSync('ffmpeg', ff, { stdio: 'inherit' });
if (r.status !== 0) process.exit(r.status || 1);
console.log('wrote', out);
