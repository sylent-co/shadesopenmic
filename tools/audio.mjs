// Render the soundtrack in headless Chrome and write a 24-bit WAV.
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import { startServer } from './serve.mjs';

const out = process.argv[2] || 'dist/soundtrack.wav';
const server = await startServer(0, '127.0.0.1');
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log('[page]', m.text()));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://127.0.0.1:${port}/tools/blank.html`);
const res = await page.evaluate(async () => {
  const { renderSoundtrack, encodeWav } = await import('/src/audio/engine.js');
  const t0 = performance.now();
  const { buffer, report } = await renderSoundtrack();
  const ms = performance.now() - t0;
  const wav = new Uint8Array(encodeWav(buffer));
  let bin = '';
  for (let i = 0; i < wav.length; i += 0x8000) bin += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
  return { b64: btoa(bin), report, ms };
});
fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
fs.writeFileSync(out, Buffer.from(res.b64, 'base64'));
console.log(JSON.stringify({ ...res.report, renderMs: Math.round(res.ms) }));
await browser.close();
server.close();
