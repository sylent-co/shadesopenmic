// Render selected timestamps to PNGs for review: node tools/frames.mjs out/dir 0.5 1.2 ...
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './serve.mjs';

const [,, outDir, ...rest] = process.argv;
const opts = { w: 1920, h: 1080, samples: 1 };
const times = [];
for (const a of rest) {
  const m = a.match(/^--(\w+)=(.*)$/);
  if (m) opts[m[1]] = Number(m[2]);
  else times.push(Number(a));
}
fs.mkdirSync(outDir, { recursive: true });
const server = await startServer(0, '127.0.0.1');
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=gl-egl', '--use-gl=angle', '--disable-gpu-sandbox', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.setViewport({ width: opts.w, height: opts.h });
await page.goto(`http://127.0.0.1:${port}/index.html?render=1&w=${opts.w}&h=${opts.h}`);
await page.waitForFunction('window.__INIT_DONE__ === true', { timeout: 60000 });
for (const t of times) {
  const t0 = Date.now();
  const url = await page.evaluate((t, s) => { window.__TRAILER__.renderFrame(t, { samples: s }); return document.getElementById('stage').toDataURL('image/png'); }, t, opts.samples);
  const file = path.join(outDir, `f_${t.toFixed(3)}.png`);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  console.log(`t=${t} -> ${file} (${Date.now() - t0} ms)`);
}
await browser.close();
server.close();
