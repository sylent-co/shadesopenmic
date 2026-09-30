// The soundtrack arrangement, locked to the visual cue sheet.
// Nature (free time, tanpura on D) -> monsoon tension -> night -> dawn ->
// a breath -> 100 BPM groove in B minor, one bar per line -> climax ->
// D major resolution with the tanpura returning under the end cards.

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
  s.duck.gain.setValueAtTime(1, 0);
  nature(s, r);
  groove(s);
  lineFx(s, r);
  climax(s);
  outro(s);
}

function nature(s, r) {
  const [s1, s2, s3] = T.shots;
  // 1. river, golden hour
  s.tanpura(0.3, 5.0, 0.9);
  s.pad(0.3, 2.62, [50, 57, 61, 64, 66], 1.0, { attack: 1.1, cutoff: 1300, release: 0.25 });
  s.waterDrop(T.impact, 1.0);
  s.waterDrop(T.impact + 0.19, 0.3, { f0: 1150, f1: 2700, pan: 0.35 });
  s.pluck(T.impact, 78, 0.55, { hall: 0.7, delay: 0.32 });
  s.boom(T.impact, 0.18, { f0: 55, f1: 38, dur: 2.2, hall: 0.3 });
  s.texture(0.35, 2.62, { v: 0.14, f: [320, 1300], q: 0.8, lfo: 3, seed: 5, gainCurve: [0, 0.6, 1, 1, 0.9, 0.8] });
  [[0.86, 69], [0.94, 74], [1.02, 78], [1.1, 81], [1.5, 76], [1.78, 74]].forEach(([t, m], i) => s.pluck(t, m, 0.4, { pan: i % 2 ? 0.25 : -0.25 }));
  [1.35, 1.6].forEach((t, i) => s.bird(t, 0.9, { pan: 0.3 + i * 0.2, base: 3400 + i * 300 }));
  s.texture(1.5, 2.62, { v: 0.16, f: [260, 1100], q: 0.7, lfo: 1.2, seed: 9, pan: -0.2, gainCurve: [0, 0.4, 1, 0.9] });
  s.rainBed(2.25, 2.62, 0.25, { fadeIn: 0.35 });
  s.reverseSwell(s2, 0.35, 0.5);
  // 2. monsoon: the cut is a thunderclap; the pulse previews the groove tempo
  s.thunder(s2, 1.0, { dur: 2.2 });
  s.rainBed(s2, 5.05, 0.55, { fadeIn: 0.02, fadeOut: 0.04 });
  s.pad(s2, 5.0, [47, 54, 59, 62], 0.9, { attack: 0.15, cutoff: 900, release: 0.2 });
  for (let t = s2, k = 0; t < 4.98; t += BEAT / 2, k++) s.bass(t, k % 4 === 3 ? 42 : 35, 0.2, 0.55 + 0.25 * (k % 2 === 0));
  [s2, 3.2, 3.8, 4.4].forEach((t, i) => s.boom(t, 0.35 + (i === 2 ? 0.35 : 0), { f0: 70, f1: 44, dur: 0.6, hall: 0.25 }));
  s.thunder(T.lightning[0] + 0.07, 1.25, { dur: 2.6 });
  s.thunder(T.lightning[1] + 0.2, 0.5, { dur: 1.2, crack: 0.4 });
  s.whoosh(3.0, 1.3, 0.35, { f0: 300, f1: 1800, p0: 0.8, p1: -0.8, q: 0.8 });
  // 3. night forest: the rain stops dead, then the insects
  s.crickets(s3 + 0.05, T.dawn[1], 1.0);
  s.tanpura(s3 + 0.1, 10.3, 0.65, { cycle: 1.8 });
  s.pad(s3 + 0.05, T.dawn[0] + 0.2, [47, 54, 59, 61, 66], 0.8, { attack: 0.8, cutoff: 1100, release: 0.8 });
  s.texture(s3, T.dawn[1], { v: 0.05, f: [300, 900], q: 0.7, lfo: 2, seed: 17, gainCurve: [0, 1, 1, 1, 0.6, 0] });
  for (let k = 0; k < 9; k++) { const t = s3 + 0.3 + r() * 0.95; s.bell(t, 86 + Math.floor(r() * 3) * 2, 0.35, { pan: r() * 1.4 - 0.7, hall: 0.7, dur: 1.6 }); }
  // the fireflies fall silent... then flash together
  [T.sync, T.sync + 0.42].forEach((t, i) => {
    [74, 78, 81, 86, 90].forEach((m, k) => s.bell(t + k * 0.012, m, 0.55 - i * 0.15, { pan: (k - 2) * 0.3, hall: 0.8, dur: 2.2 }));
    s.boom(t, 0.22, { f0: 52, f1: 40, dur: 1.2, hall: 0.4 });
  });
  s.reverseSwell(T.sync, 0.5, 0.25);
  // 4. dawn: koel calls, birds, the murmuration rushing overhead
  s.pad(T.dawn[0], T.push[0] + 0.2, [50, 57, 62, 66, 69, 76], 1.0, { attack: 1.2, cutoff: 1900, release: 0.6 });
  [[8.15, 1.0, 0.5], [8.95, 1.08, 0.45], [9.7, 1.16, 0.4]].forEach(([t, p, pan]) => s.koel(t, 1.0, { pitch: p, pan }));
  [7.95, 8.4, 8.7, 9.2, 9.45, 9.9].forEach((t, i) => s.bird(t, 0.8, { pan: -0.5 + (i % 4) * 0.3, base: 3200 + i * 180 }));
  s.whoosh(8.1, 1.2, 0.3, { f0: 250, f1: 1400, p0: -0.8, p1: 0.4, q: 0.6 });
  s.whoosh(9.2, 1.0, 0.28, { f0: 300, f1: 1800, p0: 0.2, p1: 0.9, q: 0.6 });
  [[9.0, 74], [9.1, 78], [9.2, 81], [9.3, 86]].forEach(([t, m], i) => s.pluck(t, m, 0.38, { pan: (i - 1.5) * 0.25 }));
  // push into the sun: "So why do you?"
  s.riser(T.push[0], T.taps[0] - 0.05, 0.45);
  s.reverseSwell(T.why, 0.5, 0.3);
  s.pluck(T.why, 76, 0.45, { hall: 0.6, delay: 0.25 });
  s.pluck(T.why + 0.2, 69, 0.3, { hall: 0.6 });
  T.taps.forEach((t, i) => s.micTap(t, i ? 0.9 : 0.75));
  s.reverseSwell(T.drop, 0.24, 0.9);
}

function duckAt(s, t, depth = 0.3, rel = 0.08) {
  s.duck.gain.setValueAtTime(depth, t);
  s.duck.gain.setTargetAtTime(1.0, t + 0.012, rel);
}

function groove(s) {
  s.boom(T.drop, 0.9, { f0: 60, f1: 30, dur: 1.6 });
  s.crash(T.drop, 0.28, { dur: 2.0 });
  const bars = 5;
  for (let bar = 0; bar < bars; bar++) {
    const o = bar * 4;
    const ln = LINES[bar];
    // kick: 1, 2-and, 3, (4-and on the last bar)
    [0, 1.5, 2, bar === bars - 1 ? 3.5 : 3.75].forEach((q, i) => { s.kick(b(o + q), i === 0 ? 1.0 : 0.82); duckAt(s, b(o + q)); });
    [1, 3].forEach((q) => s.clap(b(o + q), 0.62));
    for (let k = 0; k < 8; k++) {
      const swing = k % 2 ? BEAT * 0.08 : 0;
      s.hat(b(o + k * 0.5) + swing, k % 2 ? 0.1 : 0.14, k === 7, k % 2 ? 0.25 : -0.2);
    }
    if (bar % 2 === 1) for (let k = 0; k < 4; k++) s.hat(b(o + 3.5 + k * 0.125), 0.06 + k * 0.02, false, 0.3);
    // bass follows the kick
    [[0, 0.5], [1.5, 0.3], [2, 0.5], [3, 0.3], [3.5, 0.25]].forEach(([q, d], i) => s.bass(b(o + q), i === 3 ? ln.root + 12 : ln.root, d * BEAT * 1.6, i === 0 ? 1 : 0.85));
    [0, 2.5].forEach((q) => s.supersaw(b(o + q), ln.stab, 0.22, 0.85, { cutoff: 6000, end: 1200 }));
    // the santoor motif from the river, now in time
    const arp = [ln.stab[0] + 12, ln.stab[2] + 12, ln.stab[1] + 12, ln.stab[3] + 12];
    for (let k = 0; k < 8; k++) s.pluck(b(o + k * 0.5), arp[k % 4], 0.15 + 0.05 * (k === 0), { out: s.music, hall: 0.15, delay: 0.08, dur: 0.9, bright: 0.75, pan: k % 2 ? 0.4 : -0.4 });
  }
}

function lineFx(s, r) {
  const [l1, l2, l3, l4, l5] = T.lines;
  // 01 POEM: key presses for the big word, then the phone keyboard
  [0.1, 0.175, 0.25, 0.325].forEach((d) => s.click(l1 + d, 0.5, { f: 2400, room: 0.25 }));
  s.whoosh(l1 + 0.38, 0.22, 0.18, { f0: 2000, f1: 6000, p0: 0.4, p1: 0.6 });
  for (let t = l1 + 0.62; t < l1 + 1.67; t += 0.028 + r() * 0.03) s.click(t, 0.1 + r() * 0.06, { f: 3500 + r() * 1500, pan: 0.45 });
  s.texture(l1 + 2.02, l2 + 0.2, { v: 0.14, f: [3000, 8000], q: 0.8, lfo: 4, pink: false, out: s.fx, seed: 12, gainCurve: [0, 0.4, 1, 0.6] });
  // 02 SONG: the shower, the fingertip on glass, and someone humming in the echo
  s.texture(l2, l3, { v: 0.06, f: [4000, 9000], q: 0.9, lfo: 4, pink: false, out: s.fx, seed: 13, gainCurve: [1, 1, 1, 0.9, 0] });
  [0.12, 0.23, 0.34, 0.45].forEach((d) => s.squeak(l2 + d, 1));
  [[0.1, 71, 0.3], [0.45, 74, 0.25], [0.72, 79, 0.45], [1.25, 78, 0.25], [1.52, 76, 0.25], [1.8, 74, 0.45]].forEach(([d, m, dur]) => s.ooh(l2 + d, m, dur, 0.9));
  s.click(l2 + 2.28, 0.6, { f: 1800, room: 0.3 });
  // 03 STORY: the building switches off, the clock flips
  const offs = [0.08, 0.13, 0.19, 0.24, 0.3, 0.34, 0.41, 0.46, 0.52, 0.57, 0.62];
  offs.forEach((d, i) => s.click(l3 + d, 0.18 + 0.04 * (i % 3), { f: 1500 + (i % 4) * 300, pan: (i % 5) * 0.4 - 0.8, room: 0.2 }));
  s.click(l3 + 0.66, 0.45, { f: 1100, room: 0.4 });
  s.whoosh(l3 + 0.68, 0.34, 0.35, { f0: 300, f1: 2400, p0: 0, p1: 0 });
  s.click(l3 + 2.28, 0.6, { f: 1700, room: 0.3 });
  // 04 JOKE: messages landing
  [0.02, 0.2, 0.36, 0.52, 0.7, 0.95].forEach((d, i) => s.pop(l4 + d, 1, { f0: 760 + i * 70, f1: 1450 + i * 100, pan: i === 5 ? 0.6 : 0.35 }));
  s.pop(l4 + 1.15, 0.9, { f0: 1200, f1: 2200, pan: 0.5 });
  s.whoosh(l4 + 2.12, 0.28, 0.55, { f0: 250, f1: 4000, p0: 0.6, p1: 0 });
  // 05 MIX: heard through the wall, then the filter opens; the neighbour knocks
  s.wall.frequency.setValueAtTime(20000, l5 - 0.05);
  s.wall.frequency.setValueAtTime(420, l5);
  s.wall.frequency.setValueAtTime(420, l5 + 0.2);
  s.wall.frequency.exponentialRampToValueAtTime(18000, l5 + 0.34);
  s.playBuffer(l5 + 0.34, s.scratchBuffer(0.32, 2.5), 0.3, { out: s.fx, room: 0.2 });
  [0.9, 1.02, 1.14].forEach((d) => s.knock(l5 + d, 1));
  s.whoosh(l5 + 2.1, 0.3, 0.5, { f0: 400, f1: 5000, p0: 0.3, p1: -0.3 });
}

function climax(s) {
  const [w1, w2, w3, w4] = T.climaxWords;
  const g = [59, 62, 67, 71];
  [w1, w2, w3].forEach((t, i) => {
    s.kick(t, 0.85 + i * 0.05);
    duckAt(s, t, 0.35, 0.05);
    s.supersaw(t, g.map((m) => m + (i === 2 ? 2 : 0)), 0.14, 1.0, { cutoff: 7000, end: 1600 });
    s.bass(t, 31 + (i === 2 ? 2 : 0), 0.14, 0.9);
    s.snare(t, 0.35 + i * 0.1, { tone: 200 + i * 20 });
  });
  s.reverseSwell(w4, 0.25, 0.7);
  s.kick(w4, 1.0, { decay: 0.5 });
  duckAt(s, w4, 0.3, 0.25);
  s.boom(w4, 1.0, { f0: 58, f1: 29, dur: 1.4 });
  s.crash(w4, 0.34, { dur: 1.8 });
  s.supersaw(w4, [57, 61, 64, 69, 73], 1.1, 1.1, { cutoff: 8000, end: 700, voices: 7, hall: 0.35 });
  s.bass(w4, 33, 1.0, 1.0);
  const roll = [];
  for (let t = 25.5; t < 25.9; t += 0.15) roll.push(t);
  for (let t = 25.9; t < 26.2; t += 0.075) roll.push(t);
  for (let t = 26.2; t < 26.39; t += 0.0375) roll.push(t);
  roll.forEach((t, i) => s.snare(t, 0.18 + (i / roll.length) * 0.5, { tone: 170 + i * 8, decay: 0.1 }));
  s.riser(25.3, T.endHit, 0.8);
  s.reverseSwell(T.endHit, 0.5, 0.8);
}

function outro(s) {
  const E = T.end;
  const t = T.endHit;
  s.kick(t, 1.0, { decay: 0.6 });
  s.boom(t, 1.0, { f0: 55, f1: 27, dur: 2.6, hall: 0.25 });
  s.crash(t, 0.32, { dur: 2.8, hall: 0.4 });
  s.supersaw(t, [50, 57, 62, 66, 69, 74], 2.2, 0.42, { cutoff: 6500, end: 520, out: s.airy, voices: 7, hall: 0.5, attack: 0.01 });
  s.pad(t, 36.0, [38, 50, 57, 62, 66, 69], 0.7, { attack: 0.6, cutoff: 1400, release: 1.0 });
  s.tanpura(t + 0.3, 36.0, 0.7);
  s.bass(t, 26, 1.6, 0.6);
  [[26.46, 86], [26.54, 90], [26.62, 93], [26.7, 98]].forEach(([tt, m], i) => s.bell(tt, m, 0.9, { pan: (i - 1.5) * 0.3 }));
  s.whoosh(26.43, 0.4, 0.3, { f0: 800, f1: 8000, p0: -0.4, p1: 0.4 });
  // a soft heartbeat under the cards keeps the momentum
  for (let tt = E[1]; tt < E[5] - 0.05; tt += BEAT) {
    const beat = Math.round((tt - E[1]) / BEAT) % 4;
    if (beat === 0 || beat === 2) s.kick(tt, beat === 0 ? 0.5 : 0.35, { decay: 0.3, click: 0.1 });
    s.hat(tt + BEAT / 2, 0.05, false, 0.2);
    if (beat === 0) s.bass(tt, 38, BEAT * 1.8, 0.45);
  }
  // SHADES / presents
  [[E[0] + 0.55, 74], [E[0] + 0.62, 78], [E[0] + 0.69, 81], [E[0] + 0.76, 86]].forEach(([tt, m], i) => s.pluck(tt, m, 0.4, { pan: (i - 1.5) * 0.25, hall: 0.45, delay: 0.2 }));
  // OPEN MIC
  s.boom(E[1] + 0.05, 0.5, { f0: 50, f1: 32, dur: 1.4, hall: 0.3 });
  s.whoosh(E[1] - 0.2, 0.28, 0.35, { f0: 300, f1: 3000, p0: 0, p1: 0 });
  s.supersaw(E[1] + 0.08, [55, 62, 67, 71], 1.2, 0.3, { cutoff: 4000, end: 700, out: s.airy, hall: 0.5 });
  // the roles, one note each
  [74, 76, 78, 81, 83].forEach((m, k) => s.pluck(E[2] + 0.22 + k * 0.15, m, 0.45, { pan: (k - 2) * 0.25, hall: 0.4, delay: 0.15 }));
  s.whoosh(E[2] - 0.15, 0.22, 0.25, { f0: 400, f1: 3000, p0: -0.3, p1: 0.3 });
  // the date rolls in
  for (let tt = E[3] + 0.12; tt < E[3] + 0.8; tt += 0.035) s.click(tt, 0.1, { f: 3000, room: 0.1 });
  s.boom(E[3] + 0.6, 0.35, { f0: 55, f1: 40, dur: 0.8, hall: 0.3 });
  s.whoosh(E[3] - 0.15, 0.22, 0.25, { f0: 400, f1: 3000, p0: 0.3, p1: -0.3 });
  // the venue, and the river
  s.texture(E[4] + 0.2, E[5], { v: 0.08, f: [320, 1300], q: 0.8, lfo: 3, seed: 21, gainCurve: [0, 0.8, 1, 0.6] });
  s.pop(E[4] + 1.1, 0.8, { f0: 700, f1: 1400 });
  s.whoosh(E[4] - 0.15, 0.22, 0.25, { f0: 400, f1: 3000, p0: -0.3, p1: 0.3 });
  // lockup
  s.kick(E[5], 0.8, { decay: 0.5 });
  s.boom(E[5], 0.8, { f0: 55, f1: 27, dur: 2.4, hall: 0.3 });
  s.supersaw(E[5], [50, 57, 62, 66, 69, 74, 78], 2.0, 0.35, { cutoff: 6000, end: 500, out: s.airy, voices: 7, hall: 0.6 });
  [[E[5] + 0.3, 86], [E[5] + 0.42, 90], [E[5] + 0.54, 93]].forEach(([tt, m], i) => s.bell(tt, m, 0.8, { pan: (i - 1) * 0.4 }));
  s.texture(E[5], 36.4, { v: 0.08, f: [320, 1300], q: 0.8, lfo: 3, seed: 23, gainCurve: [0, 0.8, 1, 0.8, 0.5, 0] });
  s.master.gain.setValueAtTime(0.9, T.fadeOut[0]);
  s.master.gain.linearRampToValueAtTime(0.0, T.duration);
}
