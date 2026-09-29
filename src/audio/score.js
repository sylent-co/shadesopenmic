// The soundtrack arrangement, locked to the visual cue sheet.
// Intro: free-time ambient in D (nature performs). Drop at T.drop into a
// 120 BPM groove in B minor (i–VI–III–VII per line), resolving to D major.

import { T, BEAT } from '../config.js';
import { mulberry32 } from '../core/math.js';

const b = (n) => T.drop + n * BEAT;

const LINES = [
  { stab: [59, 62, 66, 71], root: 35 }, // Bm   POEM
  { stab: [59, 62, 67, 71], root: 31 }, // G    SONG
  { stab: [57, 62, 66, 69], root: 38 }, // D    STORY
  { stab: [57, 61, 64, 69], root: 33 }, // A    JOKE
  { stab: [59, 62, 66, 71], root: 35 }, // Bm   MIX
];

export function score(s) {
  const r = mulberry32(31337);
  intro(s, r);
  groove(s, r);
  lineFx(s, r);
  climax(s, r);
  outro(s, r);
}

function intro(s) {
  // warm pads under the three nature lines
  s.pad(0.30, 2.12, [50, 57, 61, 64, 66], 1.0, { attack: 1.3, cutoff: 1300 });
  s.pad(2.00, 3.38, [47, 54, 57, 62, 64], 1.0, { attack: 0.7, cutoff: 1400 });
  s.pad(3.26, 4.60, [43, 50, 54, 59, 64], 1.0, { attack: 0.7, cutoff: 1500 });
  s.pad(4.46, 5.16, [45, 52, 57, 59, 62], 0.85, { attack: 0.35, cutoff: 1700, release: 0.5 });
  // the droplet
  s.waterDrop(T.impact, 1.0);
  s.waterDrop(T.impact + 0.19, 0.3, { f0: 1150, f1: 2700, pan: 0.35 });
  s.pluck(T.impact, 78, 0.55, { hall: 0.7, delay: 0.32 });
  s.boom(T.impact, 0.18, { f0: 55, f1: 38, dur: 2.2, hall: 0.3 });
  // the river hums
  s.texture(0.35, 4.7, { v: 0.14, f: [320, 1300], q: 0.8, lfo: 3, seed: 5, gainCurve: [0, 0.55, 1, 1, 0.9, 0.7, 0.5, 0.3, 0.15, 0] });
  s.texture(0.35, 4.7, { v: 0.07, f: [1000, 3400], q: 1.6, lfo: 6, seed: 6, pan: 0.35, gainCurve: [0, 0.4, 1, 0.9, 0.7, 0.5, 0.35, 0.2, 0.1, 0] });
  s.hum(0.80, 2.15, 50, 1.0);
  s.hum(0.95, 2.15, 57, 0.55);
  [[0.78, 69], [0.86, 74], [0.94, 78], [1.02, 81], [1.38, 76], [1.62, 74]].forEach(([t, m], i) => s.pluck(t, m, 0.42, { pan: (i % 2 ? 0.25 : -0.25) }));
  // the wind recites
  s.texture(1.65, 3.9, { v: 0.2, f: [260, 1100], q: 0.7, lfo: 1.2, seed: 9, pan: -0.2, gainCurve: [0, 0.2, 0.6, 1, 0.9, 0.7, 0.4, 0.15, 0] });
  s.texture(1.9, 3.7, { v: 0.08, f: [1800, 5200], q: 2.5, lfo: 2, seed: 10, pan: 0.4, gainCurve: [0, 0.4, 1, 0.8, 0.5, 0.2, 0] });
  [[2.06, 66], [2.14, 71], [2.22, 74], [2.30, 78], [2.62, 81], [2.88, 78]].forEach(([t, m], i) => s.pluck(t, m, 0.4, { pan: (i % 2 ? -0.3 : 0.3) }));
  [1.58, 1.74, 2.42, 2.95, 3.5].forEach((t, i) => s.bird(t, 0.9, { pan: 0.25 + (i % 3) * 0.2, base: 3300 + i * 250 }));
  // the leaves applaud: rustle grains morph into a clapping crowd
  const t0 = 3.0;
  const buf = s.applauseBuffer(2.0, (u) => {
    const rustle = Math.min(1, u / 0.35) * (1 - Math.min(1, Math.max(0, (u - 1.1) / 0.5)));
    const clap = Math.min(1, Math.max(0, (u - 0.5) / 0.45)) * (1 - Math.min(1, Math.max(0, (u - 1.25) / 0.55)));
    return { rustle: rustle * 0.85, rustleAmp: 0.4 + 0.6 * rustle, clap };
  });
  s.playBuffer(t0, buf, 0.8, { out: s.amb, hall: 0.25, room: 0.2 });
  [[3.32, 67], [3.40, 71], [3.48, 74], [3.56, 79], [3.86, 78], [4.12, 76]].forEach(([t, m], i) => s.pluck(t, m, 0.38, { pan: (i % 2 ? 0.3 : -0.3) }));
  // Your turn. — the room settles, then the mic is tapped twice
  s.reverseSwell(T.turn + 0.02, 0.5, 0.35);
  s.pluck(T.turn, 76, 0.45, { hall: 0.6, delay: 0.25 });
  s.pluck(T.turn + 0.22, 69, 0.3, { hall: 0.6 });
  T.taps.forEach((t, i) => s.micTap(t, i ? 0.9 : 0.75));
  s.reverseSwell(T.drop, 0.22, 0.9);
}

function duckAt(s, t, depth = 0.3, rel = 0.075) {
  s.duck.gain.setValueAtTime(depth, t);
  s.duck.gain.setTargetAtTime(1.0, t + 0.012, rel);
}

function groove(s, r) {
  s.duck.gain.setValueAtTime(1, 0);
  // drop impact
  s.boom(T.drop, 0.9, { f0: 60, f1: 30, dur: 1.6 });
  s.crash(T.drop, 0.28, { dur: 2.0 });
  for (let n = 0; n <= 9; n++) {
    s.kick(b(n), n === 0 ? 1.0 : 0.88);
    duckAt(s, b(n));
  }
  [1, 3, 5, 7, 9].forEach((n) => s.clap(b(n), 0.62));
  // hats: 16ths with an off-beat open hat
  for (let k = 0; k < 40; k++) {
    const t = b(k / 4);
    const step = k % 4;
    if (step === 2) s.hat(t, 0.16, true, 0.2);
    else s.hat(t, step === 0 ? 0.13 : 0.075 + r() * 0.03, false, step === 1 ? -0.25 : 0.25);
  }
  // bass octave bounce + off-beat supersaw stabs per line chord
  LINES.forEach((ln, i) => {
    for (let q = 0; q < 4; q++) {
      const t = b(i * 2 + q * 0.5);
      s.bass(t, q % 2 ? ln.root + 12 : ln.root, 0.2, q % 2 ? 0.8 : 1);
    }
    [0.5, 1.5].forEach((o) => s.supersaw(b(i * 2 + o), ln.stab, 0.2, 0.9, { cutoff: 6000, end: 1200 }));
    // soft 16th arpeggio for motion (lines 2–4)
    if (i >= 1 && i <= 3) {
      const arp = [ln.stab[0] + 12, ln.stab[2] + 12, ln.stab[1] + 12, ln.stab[3] + 12];
      for (let k = 0; k < 8; k++) s.pluck(b(i * 2 + k * 0.25), arp[k % 4], 0.16, { out: s.music, hall: 0.15, delay: 0.08, dur: 0.9, bright: 0.75, pan: k % 2 ? 0.4 : -0.4 });
    }
  });
}

function lineFx(s, r) {
  // 01 POEM: typing on the tail
  for (let k = 0; k < 14; k++) s.click(5.76 + k * 0.026 + r() * 0.006, 0.16 + r() * 0.08, { f: 3000 + r() * 1500, pan: (r() - 0.5) * 0.4 });
  s.whoosh(6.34, 0.16, 0.5, { f0: 500, f1: 6000, p0: -0.2, p1: 0.2 });
  // 02 SONG: shower hiss and a little whistled phrase
  s.texture(6.5, 7.4, { v: 0.05, f: [4000, 9000], q: 0.9, lfo: 4, pink: false, out: s.fx, seed: 12, gainCurve: [0, 1, 1, 0.8, 0] });
  s.whistle(6.62, [78, 81, 83, 81], 0.12, 0.9);
  s.zap(7.37, 0.9);
  // 03 STORY: clock tick/tock and crickets
  s.click(7.52, 0.22, { f: 2600, room: 0.3 });
  s.click(7.68, 0.28, { f: 2100, room: 0.3 });
  for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) s.pop(7.6 + k * 0.14 + j * 0.022, 0.05, { f0: 4300, f1: 4500, pan: 0.5 });
  s.whoosh(8.34, 0.16, 0.55, { f0: 350, f1: 3500, p0: 0, p1: 0 });
  // 04 JOKE: message pops
  [[8.54, -0.5], [8.65, 0.5], [8.80, -0.5], [8.92, 0.5], [9.08, -0.5]].forEach(([t, p], i) => s.pop(t, 1, { f0: 820 + i * 60, f1: 1500 + i * 90, pan: p }));
  s.pop(9.32, 1.4, { f0: 180, f1: 900 });
  s.whoosh(9.3, 0.2, 0.6, { f0: 250, f1: 4000, p0: 0.6, p1: -0.2 });
  // 05 MIX: heard through the wall, then the filter opens; scratch
  s.wall.frequency.setValueAtTime(20000, 9.45);
  s.wall.frequency.setValueAtTime(380, 9.5);
  s.wall.frequency.setValueAtTime(380, 9.64);
  s.wall.frequency.exponentialRampToValueAtTime(18000, 9.8);
  s.playBuffer(9.76, s.scratchBuffer(0.32, 2.5), 0.32, { out: s.fx, room: 0.2 });
  s.whoosh(10.34, 0.16, 0.5, { f0: 400, f1: 5000, p0: 0.3, p1: -0.3 });
}

function climax(s) {
  const [w1, w2, w3, w4] = T.climaxWords;
  const g = [59, 62, 67, 71];
  [w1, w2, w3].forEach((t, i) => {
    s.kick(t, 0.85 + i * 0.05);
    duckAt(s, t, 0.35, 0.05);
    s.supersaw(t, g.map((m) => m + (i === 2 ? 2 : 0)), 0.11, 1.0, { cutoff: 7000, end: 1600 });
    s.bass(t, 31 + (i === 2 ? 2 : 0), 0.11, 0.9);
    s.snare(t, 0.35 + i * 0.1, { tone: 200 + i * 20 });
  });
  s.reverseSwell(w4, 0.2, 0.7);
  // MIC.
  s.kick(w4, 1.0, { decay: 0.5 });
  duckAt(s, w4, 0.3, 0.25);
  s.boom(w4, 1.0, { f0: 58, f1: 29, dur: 1.4 });
  s.crash(w4, 0.34, { dur: 1.8 });
  s.supersaw(w4, [57, 61, 64, 69, 73], 0.95, 1.1, { cutoff: 8000, end: 700, voices: 7, hall: 0.35 });
  s.bass(w4, 33, 0.9, 1.0);
  // build into the logo
  const roll = [];
  for (let t = 11.25; t < 11.62; t += 0.125) roll.push(t);
  for (let t = 11.625; t < 11.87; t += 0.0625) roll.push(t);
  for (let t = 11.875; t < 11.995; t += 0.03125) roll.push(t);
  roll.forEach((t, i) => s.snare(t, 0.18 + (i / roll.length) * 0.5, { tone: 170 + i * 9, decay: 0.1 }));
  s.riser(11.15, 12.0, 0.8);
  s.reverseSwell(T.endHit, 0.5, 0.8);
}

function outro(s) {
  const t = T.endHit;
  s.kick(t, 1.0, { decay: 0.6 });
  s.boom(t, 1.0, { f0: 55, f1: 27, dur: 2.6, hall: 0.25 });
  s.crash(t, 0.32, { dur: 2.8, hall: 0.4 });
  // D major resolution: wide supersaw that closes slowly + pad
  s.supersaw(t, [50, 57, 62, 66, 69, 74], 2.2, 0.42, { cutoff: 6500, end: 520, out: s.airy, voices: 7, hall: 0.5, attack: 0.01 });
  s.pad(t, 16.1, [38, 50, 57, 62, 66, 69], 0.75, { attack: 0.5, cutoff: 1400, release: 1.2 });
  s.bass(t, 26, 1.6, 0.6);
  // shimmer as the mark sweeps in
  [[12.08, 86], [12.16, 90], [12.24, 93], [12.32, 98]].forEach(([tt, m], i) => s.bell(tt, m, 0.9, { pan: (i - 1.5) * 0.3 }));
  s.whoosh(12.03, 0.4, 0.3, { f0: 800, f1: 8000, p0: -0.4, p1: 0.4 });
  // lockup builds
  s.whoosh(T.endLock + 0.04, 0.24, 0.35, { f0: 300, f1: 2500, p0: 0, p1: 0 });
  [[T.endLock + 0.1, 74], [T.endLock + 0.225, 78], [T.endLock + 0.35, 81], [T.endLock + 0.475, 86]].forEach(([tt, m], i) => s.pluck(tt, m, 0.45, { pan: (i - 1.5) * 0.25, hall: 0.45, delay: 0.22 }));
  [13.05, 13.26, 13.42].forEach((tt, i) => s.click(tt, 0.12, { f: 5200 - i * 400, room: 0.3 }));
  s.pluck(14.1, 81, 0.3, { hall: 0.6, delay: 0.3 });
  s.pluck(14.6, 74, 0.25, { hall: 0.6, delay: 0.3 });
  // the river returns under the lockup
  s.texture(12.6, 16.5, { v: 0.09, f: [320, 1300], q: 0.8, lfo: 3, seed: 21, gainCurve: [0, 0.6, 1, 1, 0.9, 0.7, 0.4, 0] });
  // master fade
  s.master.gain.setValueAtTime(0.9, T.fadeOut[0]);
  s.master.gain.linearRampToValueAtTime(0.0, T.duration);
}
