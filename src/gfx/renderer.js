// Frame pipeline: landscape (optional) -> composite with 2D layers -> bloom ->
// grade into an accumulation buffer (temporal super-sampling = real motion
// blur for offline renders) -> present with grain, letterbox and dither.

import { createContext, createProgram, createTarget, deleteTarget, createTexture, uploadCanvas, pass } from './gl.js';
import * as SH from './shaders.js';

const HALTON = (i, b) => {
  let f = 1, r = 0;
  while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); }
  return r;
};

export class Renderer {
  constructor(canvas, { width, height, softwareCanvas = false }) {
    this.canvas = canvas;
    this.gl = createContext(canvas, { preserveDrawingBuffer: true });
    const gl = this.gl;
    this.softwareCanvas = softwareCanvas;
    this.prog = {
      land: createProgram(gl, SH.LANDSCAPE, 'landscape'),
      comp: createProgram(gl, SH.COMPOSITE, 'composite'),
      pre: createProgram(gl, SH.BLOOM_PREFILTER, 'bloom-prefilter'),
      down: createProgram(gl, SH.BLOOM_DOWN, 'bloom-down'),
      up: createProgram(gl, SH.BLOOM_UP, 'bloom-up'),
      grade: createProgram(gl, SH.GRADE, 'grade'),
      present: createProgram(gl, SH.PRESENT, 'present'),
      blur: createProgram(gl, SH.BLUR, 'blur'),
    };
    this.layerTex = createTexture(gl);
    this.glowTex = createTexture(gl);
    this.softTex = createTexture(gl);
    this.blackTex = createTexture(gl);
    gl.bindTexture(gl.TEXTURE_2D, this.blackTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
    this.markTex = createTexture(gl, { mipmap: true });
    this.resize(width, height);
  }

  resize(width, height) {
    const gl = this.gl;
    this.W = width; this.H = height;
    this.canvas.width = width; this.canvas.height = height;
    for (const k of ['scene', 'comp', 'accum', 'softA', 'softB']) deleteTarget(gl, this[k]);
    (this.mips || []).forEach((m) => deleteTarget(gl, m));
    this.scene = createTarget(gl, width, height);
    this.comp = createTarget(gl, width, height);
    this.accum = createTarget(gl, width, height);
    this.softA = createTarget(gl, width >> 1, height >> 1);
    this.softB = createTarget(gl, width >> 1, height >> 1);
    this.mips = [];
    let w = width >> 1, h = height >> 1;
    for (let i = 0; i < 6 && w > 8 && h > 8; i++) { this.mips.push(createTarget(gl, w, h)); w >>= 1; h >>= 1; }
    const mk = (scale = 1) => {
      const c = document.createElement('canvas');
      c.width = Math.round(width * scale); c.height = Math.round(height * scale);
      const ctx = c.getContext('2d', { willReadFrequently: this.softwareCanvas });
      return { c, ctx };
    };
    this.layer = mk();
    this.glow = mk();
    this.soft = mk(0.5);
  }

  setMarkTexture(canvas) { uploadCanvas(this.gl, this.markTex, canvas, { mipmap: true }); }

  /** Render one temporal sample and accumulate it with `weight`. */
  renderSample(st, sampleIndex, weight, clearAccum) {
    const gl = this.gl;
    const W = this.W, H = this.H;
    // 1. scene
    if (st.scene) {
      const j = st.jitter ? [HALTON(sampleIndex + 1, 2) - 0.5, HALTON(sampleIndex + 1, 3) - 0.5] : [0, 0];
      pass(gl, this.prog.land, this.scene, { ...st.scene, uRes: [W, H], uJitter: j, uMarkTex: { tex: this.markTex } });
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.fb);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    // 2. 2D layers
    let layerTex = this.blackTex, glowTex = this.blackTex;
    if (st.layerUsed) { uploadCanvas(gl, this.layerTex, this.layer.c); layerTex = this.layerTex; }
    if (st.glowUsed) { uploadCanvas(gl, this.glowTex, this.glow.c); glowTex = this.glowTex; }
    const p = st.post;
    // soft layer: half-res canvas, separable gaussian twice (~14 px sigma at full res)
    let softTex = this.blackTex;
    if (st.softUsed) {
      uploadCanvas(gl, this.softTex, this.soft.c);
      const sw = this.softA.w, sh = this.softA.h;
      pass(gl, this.prog.blur, this.softA, { uSrc: { tex: this.softTex }, uDir: [2.2 / sw, 0] });
      pass(gl, this.prog.blur, this.softB, { uSrc: { tex: this.softA.tex }, uDir: [0, 2.2 / sh] });
      pass(gl, this.prog.blur, this.softA, { uSrc: { tex: this.softB.tex }, uDir: [1.4 / sw, 0] });
      pass(gl, this.prog.blur, this.softB, { uSrc: { tex: this.softA.tex }, uDir: [0, 1.4 / sh] });
      softTex = this.softB.tex;
    }
    pass(gl, this.prog.comp, this.comp, {
      uScene: { tex: this.scene.tex }, uLayer: { tex: layerTex }, uGlow: { tex: glowTex }, uSoft: { tex: softTex },
      uRes: [W, H], uGlowGain: p.glowGain, uLayerGain: p.layerGain, uSceneGain: p.sceneGain,
      uShake: [p.shake[0] * H, p.shake[1] * H], uShakeRot: p.shakeRot, uZoom: p.zoom,
      uDirBlur: [p.dirBlur[0] * H, p.dirBlur[1] * H], uFlash: p.flash, uFlashColor: p.flashColor,
    });
    // 3. bloom
    const m = this.mips;
    pass(gl, this.prog.pre, m[0], { uSrc: { tex: this.comp.tex }, uTexel: [1 / W, 1 / H], uThreshold: p.bloomThreshold, uKnee: 0.5 });
    for (let i = 1; i < m.length; i++) pass(gl, this.prog.down, m[i], { uSrc: { tex: m[i - 1].tex }, uTexel: [1 / m[i - 1].w, 1 / m[i - 1].h] });
    for (let i = m.length - 2; i >= 0; i--) {
      pass(gl, this.prog.up, m[i], { uSrc: { tex: m[i + 1].tex }, uTexel: [1 / m[i + 1].w, 1 / m[i + 1].h], uWeight: 1.0 }, { blend: [gl.ONE, gl.ONE] });
    }
    // 4. grade into accumulation buffer
    if (clearAccum) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fb);
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    pass(gl, this.prog.grade, this.accum, {
      uComp: { tex: this.comp.tex }, uBloom: { tex: m[0].tex }, uRes: [W, H],
      uBloomAmt: p.bloom, uCA: p.ca, uVignette: p.vignette, uExposure: p.exposure, uWarm: p.warm,
      uSat: p.sat, uContrast: p.contrast, uHalation: p.halation, uFade: p.fade, uAccumWeight: weight,
    }, { blend: [gl.ONE, gl.ONE] });
  }

  present(post, time, seed) {
    pass(this.gl, this.prog.present, null, {
      uAccum: { tex: this.accum.tex }, uRes: [this.W, this.H], uTime: time,
      uGrain: post.grain, uLetterbox: post.letterbox, uSeed: seed,
    });
  }
}
