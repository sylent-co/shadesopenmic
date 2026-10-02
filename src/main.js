// SHADES Open Mic trailer: entry point for live playback and offline rendering.

import { loadFontFiles } from './core/fonts.js';
import { Renderer } from './gfx/renderer.js';
import { composeFrame } from './scenes/director.js';
import { markTextureCanvas } from './scenes/logo.js';
import { T } from './config.js';

const FONT_URLS = {
  mona: 'assets/fonts/MonaSans-VF.ttf',
  serif: 'assets/fonts/InstrumentSerif-Regular.ttf',
  serifIt: 'assets/fonts/InstrumentSerif-Italic.ttf',
  mono: 'assets/fonts/JetBrainsMono-VF.ttf',
};

export class Trailer {
  constructor(canvas, { width = 1920, height = 1080, software = false } = {}) {
    this.canvas = canvas;
    this.software = software;
    this.size = [width, height];
    this.duration = T.duration;
  }

  async init() {
    await loadFontFiles(window.__EMBEDDED_FONTS__ || FONT_URLS);
    this.renderer = new Renderer(this.canvas, { width: this.size[0], height: this.size[1], softwareCanvas: this.software });
    this.renderer.setMarkTexture(markTextureCanvas(2048));
    return this;
  }

  resize(w, h) { this.size = [w, h]; this.renderer.resize(w, h); }

  /** Render the frame at time t (seconds). samples > 1 adds motion blur. */
  renderFrame(t, { samples = 1, shutter = 0.5, fps = 60 } = {}) {
    const R = this.renderer;
    const W = R.W, H = R.H;
    let lastPost = null;
    for (let i = 0; i < samples; i++) {
      const ts = samples > 1 ? t + ((i + 0.5) / samples - 0.5) * (shutter / fps) : t;
      const L = R.layer.ctx, G = R.glow.ctx, S = R.soft.ctx;
      for (const c of [L, G, S]) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none'; }
      L.clearRect(0, 0, W, H); G.clearRect(0, 0, W, H); S.clearRect(0, 0, R.soft.c.width, R.soft.c.height);
      S.setTransform(0.5, 0, 0, 0.5, 0, 0);
      G.globalCompositeOperation = 'lighter';
      const K = { L, S, G, W, H, samples };
      const st = composeFrame(ts, K);
      R.renderSample({ scene: st.scene, post: st.post, layerUsed: true, glowUsed: true, softUsed: true, jitter: samples > 1 }, i, 1 / samples, i === 0);
      if (Math.abs(ts - t) < 1e-9 || !lastPost) lastPost = st.post;
    }
    R.present(lastPost, t, Math.floor(t * 60) % 997);
  }
}
