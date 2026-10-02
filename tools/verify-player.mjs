// Smoke-test the player UI: node tools/verify-player.mjs <url> <shot-prefix>
import puppeteer from 'puppeteer-core';
const [,, url, prefix = '.hoplite/artifacts/player'] = process.argv;
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/google-chrome', headless: true,
  args: ['--no-sandbox', '--use-angle=gl-egl', '--use-gl=angle', '--disable-gpu-sandbox', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files'] });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
await page.setViewport({ width: 1280, height: 720 });
await page.goto(url);
await page.waitForFunction(() => !document.getElementById('play').disabled, { timeout: 180000 });
const status = await page.$eval('#status', (e) => e.textContent);
await page.screenshot({ path: `${prefix}-start.png` });
await page.click('#play');
await new Promise((r) => setTimeout(r, 2500));
const state = await page.evaluate(() => ({ playing: document.body.classList.contains('playing'), time: document.getElementById('time').textContent, size: [window.__TRAILER__.renderer.W, window.__TRAILER__.renderer.H] }));
await page.keyboard.press('Space');
await page.evaluate(() => window.__TRAILER__.renderFrame(10.02));
await page.mouse.move(640, 400);
await new Promise((r) => setTimeout(r, 300));
await page.screenshot({ path: `${prefix}-mix.png` });
const widths = await page.evaluate(async () => {
  const c = document.createElement('canvas').getContext('2d');
  const out = {};
  for (const f of document.fonts) if (/^mona_900_(75|125)$/.test(f.family)) { c.font = `100px "${f.family}"`; out[f.family] = Math.round(c.measureText('MIX').width); }
  return out;
});
console.log(JSON.stringify({ status, state, widths, errors }, null, 1));
await browser.close();
