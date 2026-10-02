// Live playback: renders the soundtrack offline at load, then drives the
// animation from the audio clock so picture and sound stay locked.

import { Trailer } from './main.js';
import { renderSoundtrack } from './audio/engine.js';
import { T } from './config.js';

const $ = (s) => document.querySelector(s);
const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${String(Math.floor((t % 1) * 10))}`;

export async function boot() {
  const q = new URLSearchParams(location.search);
  const portrait = q.has('portrait');
  const stage = $('#stage');
  const frame = $('#frame');
  const [baseW, baseH] = portrait ? [1080, 1920] : [1920, 1080];
  frame.style.aspectRatio = `${baseW} / ${baseH}`;
  document.body.classList.toggle('portrait', portrait);

  const pickSize = () => {
    const r = frame.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = Math.min(1, (r.width * dpr) / baseW) * (Number(q.get('quality')) || 1);
    return [Math.max(320, Math.round(baseW * scale / 2) * 2), Math.max(180, Math.round(baseH * scale / 2) * 2)];
  };
  const [w, h] = pickSize();
  let trailer;
  try {
    trailer = await new Trailer(stage, { width: w, height: h }).init();
  } catch (e) {
    fallbackToVideo(portrait, e);
    return;
  }
  window.__TRAILER__ = trailer;
  trailer.renderFrame(0);

  const status = $('#status');
  status.textContent = 'Composing the soundtrack…';
  let audioBuffer = null;
  const audioReady = renderSoundtrack().then(({ buffer }) => { audioBuffer = buffer; status.textContent = 'Ready — best with sound on.'; $('#play').disabled = false; })
    .catch((e) => { console.warn('audio unavailable', e); status.textContent = 'Ready (audio unavailable in this browser).'; $('#play').disabled = false; });

  let ctx = null, src = null, t0 = 0, playing = false, ended = false, wallStart = 0, pausedAt = 0;
  const now = () => {
    if (ctx && audioBuffer) return ctx.currentTime - t0 - (ctx.outputLatency || ctx.baseLatency || 0);
    return (performance.now() - wallStart) / 1000;
  };

  function start(from = 0) {
    ended = false;
    if (audioBuffer) {
      ctx ||= new AudioContext({ sampleRate: audioBuffer.sampleRate, latencyHint: 'interactive' });
      if (src) { src.onended = null; try { src.stop(); } catch {} }
      src = ctx.createBufferSource();
      src.buffer = audioBuffer;
      src.connect(ctx.destination);
      const at = ctx.currentTime + 0.05;
      src.start(at, Math.max(0, from));
      t0 = at - from;
      if (ctx.state === 'suspended') ctx.resume();
    } else wallStart = performance.now() - from * 1000;
    playing = true;
    document.body.classList.add('playing');
    document.body.classList.remove('ended', 'paused');
  }

  function pause() {
    if (!playing) return;
    playing = false;
    pausedAt = Math.min(T.duration, Math.max(0, now()));
    if (ctx) ctx.suspend();
    document.body.classList.add('paused');
  }
  function resume() {
    if (playing || ended) return;
    if (ctx && audioBuffer) { ctx.resume(); playing = true; }
    else start(pausedAt);
    playing = true;
    document.body.classList.remove('paused');
  }
  const toggle = () => (ended ? start(0) : playing ? pause() : resume());
  const seek = (t) => { const tt = Math.min(T.duration - 0.01, Math.max(0, t)); if (playing) start(tt); else { pausedAt = tt; trailer.renderFrame(tt); if (ctx && audioBuffer) { start(tt); pause(); } } };

  function tick() {
    requestAnimationFrame(tick);
    const t = playing ? now() : pausedAt;
    if (playing && t >= T.duration) {
      playing = false; ended = true; pausedAt = T.duration;
      document.body.classList.add('ended');
      document.body.classList.remove('playing');
    }
    if (playing || document.body.classList.contains('scrubbing')) trailer.renderFrame(Math.min(T.duration - 1e-3, Math.max(0, t)));
    $('#bar').style.transform = `scaleX(${Math.min(1, Math.max(0, t / T.duration))})`;
    $('#time').textContent = `${fmt(Math.max(0, Math.min(t, T.duration)))} / ${fmt(T.duration)}`;
  }
  requestAnimationFrame(tick);

  $('#play').addEventListener('click', async () => { await audioReady; $('#intro').classList.add('gone'); start(0); });
  $('#replay').addEventListener('click', () => start(0));
  $('#pp').addEventListener('click', toggle);
  $('#restart').addEventListener('click', () => start(0));
  $('#fs').addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : frame.requestFullscreen?.()));
  const scrub = $('#scrub');
  const scrubTo = (e) => { const r = scrub.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * T.duration); };
  scrub.addEventListener('pointerdown', (e) => { scrub.setPointerCapture(e.pointerId); document.body.classList.add('scrubbing'); scrubTo(e); });
  scrub.addEventListener('pointermove', (e) => { if (document.body.classList.contains('scrubbing')) scrubTo(e); });
  scrub.addEventListener('pointerup', () => document.body.classList.remove('scrubbing'));
  window.addEventListener('keydown', (e) => {
    if ($('#intro') && !$('#intro').classList.contains('gone')) { if (e.code === 'Space' || e.code === 'Enter') $('#play').click(); return; }
    if (e.code === 'Space') { e.preventDefault(); toggle(); }
    if (e.key === 'r' || e.key === 'R') start(0);
    if (e.key === 'f' || e.key === 'F') $('#fs').click();
    if (e.code === 'ArrowRight') seek((playing ? now() : pausedAt) + 1);
    if (e.code === 'ArrowLeft') seek((playing ? now() : pausedAt) - 1);
  });
  let idle;
  window.addEventListener('pointermove', () => { document.body.classList.add('ui'); clearTimeout(idle); idle = setTimeout(() => document.body.classList.remove('ui'), 1800); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  window.addEventListener('resize', () => { const [nw, nh] = pickSize(); if (nw !== trailer.renderer.W) { trailer.resize(nw, nh); trailer.renderFrame(Math.max(0, playing ? now() : pausedAt)); } });
}

/** No WebGL2 (e.g. GPU disabled): play the pre-rendered film instead. */
async function fallbackToVideo(portrait, err) {
  console.warn('Live renderer unavailable, falling back to the rendered film:', err.message);
  const src = portrait ? 'release/SHADES-OpenMic-Trailer-1080x1920-30.mp4' : 'release/SHADES-OpenMic-Trailer-1080p60.mp4';
  const status = $('#status');
  const ok = location.protocol.startsWith('http') && await fetch(src, { method: 'HEAD' }).then((r) => r.ok).catch(() => false);
  if (!ok) {
    status.textContent = 'This browser has WebGL2 turned off, which the live trailer needs. Try Chrome, Edge, Firefox or Safari with hardware acceleration on, or watch the MP4 in /release.';
    return;
  }
  const v = document.createElement('video');
  Object.assign(v, { src, controls: true, playsInline: true });
  v.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;background:#000;z-index:1';
  $('#stage').replaceWith(v);
  status.textContent = 'Live renderer unavailable here, playing the rendered film.';
  const btn = $('#play');
  btn.disabled = false;
  btn.addEventListener('click', () => { $('#intro').classList.add('gone'); v.play(); });
}
