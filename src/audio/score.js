// The soundtrack arrangement, locked to the visual cue sheet (110 BPM, B minor).
//
// Opening: counted from the droplet's impact. A pulse from the very first
// frame, a santoor motif, drums arriving with the monsoon, a dead stop into
// the night, a build through dawn, silence, two mic taps, then the drop.
// Middle: one bar per line, each with its own feel and its foley played as
// an instrument; a vocal-chop hook that grows through the section.
// Climax and outro: the "GIVE IT A MIC" hit, then D major under the end cards.

import { T, BEAT, BAR, GROOVE } from '../config.js';
import { mulberry32 } from '../core/math.js';

const nb = (b) => T.impact + b * BEAT; // opening beats from impact
const lb = (i, q) => T.lines[i] + q * BEAT; // beat q of line bar i
const WARP = 2.4 / BAR; // visual scenes are authored on a 2.4 s bar
const lv = (i, d) => T.lines[i] + d / WARP; // design-time offset inside line i

const CHORDS = [
  { stab: [59, 62, 66, 71], root: 35 }, // Bm   POEM
  { stab: [59, 62, 67, 71], root: 31 }, // G    SONG
  { stab: [57, 62, 66, 69], root: 38 }, // D    STORY
  { stab: [57, 61, 64, 69], root: 33 }, // A    JOKE
  { stab: [59, 62, 66, 71], root: 35 }, // Bm   MIX
];
// The hook, in [beat, midi, length-in-beats]; previewed on santoor at the river.
const HOOK = [[0, 71, 0.4], [0.5, 74, 0.4], [1, 78, 0.65], [1.75, 76, 0.4], [2.25, 74, 0.2], [2.5, 71, 0.4], [3, 69, 0.4], [3.5, 74, 0.4]];

export function score(s) {
  const r = mulberry32(31337);
  s.duck.gain.setValueAtTime(1, 0);
  opening(s, r);
  middle(s, r);
  climax(s);
  outro(s);
}

function duckAt(s, t, depth = 0.3, rel = 0.07) {
  s.duck.gain.setValueAtTime(depth, t);
  s.duck.gain.setTargetAtTime(1.0, t + 0.012, rel);
}

// ---- opening -----------------------------------------------------------------
function opening(s, r) {
  const [, s2, s3] = T.shots;
  // frame one: a heartbeat under black while the drop falls, rising into impact
  s.kick(0.02, 0.5, { f0: 90, f1: 42, decay: 0.3, click: 0.05 });
  s.kick(0.2, 0.32, { f0: 80, f1: 40, decay: 0.25, click: 0.03 });
  s.reverseSwell(T.impact, 0.36, 0.5);
  s.whoosh(T.dropFall, T.impact - T.dropFall, 0.22, { f0: 900, f1: 5000, p0: 0, p1: 0, q: 2 });
  // impact
  s.boom(T.impact, 0.75, { f0: 58, f1: 30, dur: 2.2, hall: 0.35 });
  s.waterDrop(T.impact, 1.0);
  s.waterDrop(T.impact + 0.19, 0.3, { f0: 1150, f1: 2700, pan: 0.35 });
  [[0, 74], [0.02, 78], [0.04, 81], [0.06, 86]].forEach(([d, m], i) => s.bell(T.impact + d, m, 0.45, { pan: (i - 1.5) * 0.3, hall: 0.7, dur: 2.4 }));
  s.pluck(T.impact, 78, 0.55, { hall: 0.7, delay: 0.32 });
  // river: tanpura, pad, a tabla heartbeat and the hook on santoor
  s.tanpura(T.impact, s3 - 0.05, 0.85, { cycle: BEAT * 4 });
  s.pad(T.impact, s2 + 0.05, [50, 57, 61, 64, 66], 1.0, { attack: 0.7, cutoff: 1400, release: 0.2 });
  s.texture(T.impact, s2, { v: 0.13, f: [320, 1300], q: 0.8, lfo: 3, seed: 5, gainCurve: [0, 0.7, 1, 1, 0.9] });
  for (let b = 1; b < 4; b++) {
    s.tabla(nb(b), 'ge', 0.55, { pan: -0.1 });
    s.tabla(nb(b + 0.5), 'na', 0.22, { pan: 0.15 });
  }
  s.tabla(nb(3.75), 'na', 0.2, { pan: 0.2 });
  HOOK.forEach(([q, m]) => s.pluck(nb(0.5 + q * 0.75), m + 12, 0.24, { pan: q % 1 ? 0.3 : -0.3, hall: 0.4, delay: 0.25 }));
  [nb(1.2), nb(2.1)].forEach((t, i) => s.bird(t, 0.8, { pan: 0.35 + i * 0.2, base: 3400 + i * 300 }));
  s.rainBed(s2 - 0.35, s2, 0.25, { fadeIn: 0.3 });
  s.reverseSwell(s2, 0.4, 0.55);
  // monsoon: thunder on the cut, the drums arrive, lightning on the grid
  s.thunder(s2, 1.0, { dur: 2.0 });
  s.rainBed(s2, s3 - 0.02, 0.5, { fadeIn: 0.02, fadeOut: 0.02 });
  s.pad(s2, s3, [47, 54, 59, 62], 0.9, { attack: 0.1, cutoff: 1000, release: 0.05 });
  for (let b = 4; b < 8; b++) {
    const t = nb(b);
    s.kick(t, b === 4 ? 1 : 0.75, { decay: 0.3 });
    s.tabla(nb(b + 0.5), 'ka', 0.5, { pan: 0.25 });
    if (b % 2 === 1) s.snare(t, 0.45, { tone: 180, room: 0.45 });
    for (let k = 0; k < 4; k++) s.hat(nb(b + k / 4), k % 2 ? 0.05 : 0.08, false, 0.2);
    s.bass(t, 35, BEAT * 0.45, 0.8);
    s.bass(nb(b + 0.5), b === 7 ? 42 : 35, BEAT * 0.4, 0.6);
  }
  s.thunder(T.lightning[0] + 0.02, 1.2, { dur: 2.2 });
  s.boom(T.lightning[0], 0.6, { f0: 60, f1: 34, dur: 1.0 });
  s.thunder(T.lightning[1] + 0.05, 0.6, { dur: 1.0, crack: 0.6 });
  for (let k = 0; k < 6; k++) s.snare(nb(7.5 + k / 12), 0.12 + k * 0.05, { tone: 190 + k * 10, decay: 0.08 });
  s.whoosh(s2 + 0.2, 1.3, 0.3, { f0: 300, f1: 1800, p0: 0.8, p1: -0.8, q: 0.8 });
  // night: the rain stops dead. Crickets, bells, a slow heartbeat.
  s.crickets(s3 + 0.05, T.dawn[1], 1.0);
  s.tanpura(s3 + 0.05, T.push[0] + 0.3, 0.6, { cycle: BEAT * 4 });
  s.pad(s3 + 0.05, T.dawn[0] + 0.3, [47, 54, 59, 61, 66], 0.8, { attack: 0.5, cutoff: 1100, release: 0.6 });
  [9, 11].forEach((b) => { s.kick(nb(b), 0.35, { f0: 80, f1: 40, decay: 0.3, click: 0.02 }); s.kick(nb(b + 0.3), 0.22, { f0: 75, f1: 38, decay: 0.25, click: 0.02 }); });
  for (let k = 0; k < 7; k++) s.bell(s3 + 0.2 + r() * 0.9, 86 + Math.floor(r() * 3) * 2, 0.3, { pan: r() * 1.4 - 0.7, hall: 0.7, dur: 1.4 });
  [T.sync, T.sync + 0.42].forEach((t, i) => {
    [74, 78, 81, 86, 90].forEach((m, k) => s.bell(t + k * 0.012, m, 0.55 - i * 0.15, { pan: (k - 2) * 0.3, hall: 0.8, dur: 2.0 }));
    s.boom(t, 0.25, { f0: 52, f1: 40, dur: 1.0, hall: 0.4 });
  });
  s.reverseSwell(T.sync, 0.45, 0.25);
  // dawn: koels, the flock, and the pulse coming back as a build
  s.pad(T.dawn[0], T.push[0] + 0.15, [50, 57, 62, 66, 69, 76], 1.0, { attack: 0.9, cutoff: 2000, release: 0.4 });
  [[T.dawn[0] + 0.25, 1.0, 0.5], [T.dawn[0] + 1.0, 1.1, 0.4]].forEach(([t, p, pan]) => s.koel(t, 1.0, { pitch: p, pan }));
  [0.4, 0.8, 1.3].forEach((d, i) => s.bird(T.flock + d, 0.7, { pan: -0.5 + i * 0.4, base: 3200 + i * 200 }));
  s.whoosh(T.flock, 1.4, 0.3, { f0: 250, f1: 1600, p0: -0.8, p1: 0.6, q: 0.6 });
  for (let b = 12; b < 15; b += 0.5) s.kick(nb(b), 0.35 + (b - 12) * 0.12, { decay: 0.22, click: 0.1 });
  for (let b = 14; b < 15; b += 0.25) s.tabla(nb(b), b % 0.5 ? 'na' : 'dha', 0.3 + (b - 14) * 0.3, { pan: (b * 4) % 2 ? 0.3 : -0.3 });
  [[12.5, 74], [13, 78], [13.5, 81], [14, 83], [14.5, 86]].forEach(([b, m], i) => s.pluck(nb(b), m, 0.3, { pan: (i - 2) * 0.25, hall: 0.35, delay: 0.2 }));
  s.riser(nb(12.5), T.push[0], 0.55);
  // push into the sun: everything drops out. "Not anymore." Two taps.
  s.boom(T.push[0], 0.45, { f0: 50, f1: 30, dur: 1.6, hall: 0.5 });
  s.pluck(T.why, 76, 0.45, { hall: 0.7, delay: 0.3 });
  s.pluck(T.why + 0.2, 69, 0.32, { hall: 0.7 });
  T.taps.forEach((t, i) => s.micTap(t, i ? 0.95 : 0.8));
  s.reverseSwell(T.drop, 0.3, 1.0);
}

// ---- middle ------------------------------------------------------------------
function drums(s, i, r) {
  const g = GROOVE[i];
  g.kick.forEach((q, k) => { s.kick(lb(i, q), k === 0 ? 1.0 : 0.82, { decay: g.feel === 'half' ? 0.45 : 0.32 }); duckAt(s, lb(i, q), g.feel === 'half' ? 0.2 : 0.32, g.feel === 'half' ? 0.14 : 0.07); });
  g.snare.forEach((q) => {
    s.clap(lb(i, q), g.feel === 'half' ? 0.75 : 0.6, { room: g.feel === 'half' ? 0.7 : 0.35 });
    s.snare(lb(i, q), g.feel === 'half' ? 0.55 : 0.4, { tone: 200, room: g.feel === 'half' ? 0.6 : 0.25, decay: g.feel === 'half' ? 0.28 : 0.16 });
  });
  const swing = BEAT * 0.06;
  for (let k = 0; k < 16; k++) {
    const q = k / 4, off = k % 2 ? swing : 0;
    if (g.feel === 'half') { if (k % 2 === 0) s.hat(lb(i, q), k % 4 ? 0.05 : 0.08, false, 0.2); continue; }
    if (k % 4 === 2) s.hat(lb(i, q), 0.12, true, -0.15);
    else s.hat(lb(i, q) + off, (k % 4 === 0 ? 0.1 : 0.055) + r() * 0.02, false, k % 2 ? 0.3 : -0.25);
  }
  if (g.feel === 'bounce') for (let k = 0; k < 16; k++) s.shaker(lb(i, k / 4) + (k % 2 ? swing : 0), k % 2 ? 0.5 : 0.8, 0.45);
}

function middle(s, r) {
  // bar 1 — POEM: the drop. Big chord, boom, and the typing as percussion.
  s.boom(T.drop, 1.0, { f0: 60, f1: 30, dur: 1.6 });
  s.crash(T.drop, 0.32, { dur: 2.0 });
  s.supersaw(T.drop, [47, 54, 59, 62, 66, 71], 0.9, 1.0, { cutoff: 8000, end: 800, voices: 7, hall: 0.35 });
  drums(s, 0, r);
  s.sub808(lb(0, 0), 35, BEAT * 1.4, 0.9);
  [[1.5, 35, 0.4], [2, 47, 0.4], [2.5, 35, 0.4], [3, 42, 0.45], [3.5, 45, 0.4]].forEach(([q, m, d]) => s.bass(lb(0, q), m, BEAT * d * 1.6, 0.85));
  [1.5, 2.5, 3.5].forEach((q) => s.supersaw(lb(0, q), CHORDS[0].stab, 0.16, 0.8, { cutoff: 6000, end: 1400 }));
  [0.1, 0.175, 0.25, 0.325].forEach((d) => s.click(lv(0, d), 0.55, { f: 2300, room: 0.25 })); // P-O-E-M
  for (let q = 2; q < 4; q += 0.25) s.click(lb(0, q) + r() * 0.012, 0.16 + r() * 0.06, { f: 3500 + r() * 1500, pan: 0.45 }); // the phone keyboard, in 16ths
  s.tabla(lb(0, 3.75), 'tin', 0.35, { pan: 0.3 });
  s.texture(lv(0, 2.0), T.lines[1] + 0.15, { v: 0.12, f: [3000, 8000], q: 0.8, lfo: 4, pink: false, out: s.fx, seed: 12, gainCurve: [0, 0.4, 1, 0.6] });
  s.reverseSwell(T.lines[1], 0.3, 0.35);

  // bar 2 — SONG: the hook arrives as a vocal chop; shaker bounce; steam hiss
  drums(s, 1, r);
  s.crash(T.lines[1], 0.14, { dur: 1.2 });
  [[0, 31, 0.9], [1.5, 31, 0.4], [2, 43, 0.4], [2.75, 38, 0.5], [3.5, 40, 0.4]].forEach(([q, m, d]) => s.bass(lb(1, q), m, BEAT * d * 1.6, 0.85));
  [0.5, 2.5].forEach((q) => s.supersaw(lb(1, q), CHORDS[1].stab, 0.18, 0.7, { cutoff: 5000, end: 1200 }));
  HOOK.forEach(([q, m, d], k) => { s.chop(lb(1, q), m, BEAT * d, 0.9, { vowel: k % 3 === 2 ? 'o' : 'a', pan: k % 2 ? 0.3 : -0.3 }); s.chop(lb(1, q), m - 12, BEAT * d, 0.35, { vowel: 'o', pan: k % 2 ? -0.5 : 0.5, delay: 0.1 }); });
  [0.12, 0.23, 0.34, 0.45].forEach((d) => s.squeak(lv(1, d), 0.7));
  s.texture(T.lines[1], T.lines[2], { v: 0.05, f: [4000, 9000], q: 0.9, lfo: 4, pink: false, out: s.fx, seed: 13, gainCurve: [1, 1, 1, 0.9, 0] });
  for (let k = 0; k < 4; k++) s.snare(lb(1, 3.5 + k / 8), 0.15 + k * 0.06, { tone: 210, decay: 0.07 });
  s.click(lv(1, 2.28), 0.7, { f: 1800, room: 0.3 }); // light switch
  s.boom(T.lines[2] - 0.01, 0.35, { f0: 70, f1: 40, dur: 0.4 });

  // bar 3 — STORY: 2 AM half-time. 808, a big reverb snare, the building
  // switching off as a descending run, the clock ticking.
  drums(s, 2, r);
  s.whoosh(T.lines[2], 0.4, 0.4, { f0: 3000, f1: 300, p0: 0, p1: 0, q: 0.8 });
  s.sub808(lb(2, 0), 38, BEAT * 2.4, 1.0, 33);
  s.sub808(lb(2, 2.5), 33, BEAT * 1.4, 0.8, 35);
  s.pad(T.lines[2], T.lines[3] - 0.05, [50, 57, 62, 66, 69], 0.9, { attack: 0.08, cutoff: 1200, release: 0.1, out: s.music });
  const run = [86, 83, 81, 78, 76, 74, 71, 69, 66, 64, 62];
  run.forEach((m, k) => {
    const t = lv(2, 0.05 + (k / (run.length - 1)) * 0.58);
    s.pluck(t, m, 0.32, { out: s.music, pan: (k % 2 ? 0.35 : -0.35), hall: 0.3, delay: 0.15, dur: 1.2, bright: 0.7 });
    s.click(t, 0.12, { f: 1400 + (k % 3) * 300, pan: (k % 5) * 0.4 - 0.8, room: 0.2 });
  });
  for (let q = 1; q < 4; q += 0.5) s.click(lb(2, q), q % 1 ? 0.14 : 0.2, { f: q % 1 ? 3200 : 2600, room: 0.35 });
  HOOK.slice(0, 4).forEach(([q, m, d]) => s.chop(lb(2, 2 + q / 2), m - 12, BEAT * d * 0.8, 0.5, { vowel: 'u', hall: 0.6, delay: 0.3 }));
  s.bell(lv(2, 1.05), 90, 0.5, { hall: 0.6, dur: 1.4 }); // "2 AM" lands
  for (let k = 0; k < 8; k++) s.tabla(lb(2, 3 + k / 8), k % 2 ? 'na' : 'dha', 0.25 + k * 0.05, { pan: k % 2 ? 0.25 : -0.25 });
  s.whoosh(lv(2, 2.16), 0.28, 0.7, { f0: 300, f1: 5000, p0: 0.8, p1: -0.9, q: 0.7 }); // whip-pan
  s.reverseSwell(T.lines[3], 0.25, 0.5);

  // bar 4 — JOKE: full bounce; message pops play a melody; "ha" chops
  drums(s, 3, r);
  s.crash(T.lines[3], 0.2, { dur: 1.4 });
  [[0, 33, 0.5], [0.75, 45, 0.3], [1.5, 33, 0.4], [2, 45, 0.3], [2.5, 40, 0.4], [3.25, 44, 0.4]].forEach(([q, m, d]) => s.bass(lb(3, q), m, BEAT * d * 1.6, 0.9));
  [0.5, 1.25, 2.5, 3.5].forEach((q) => s.supersaw(lb(3, q), CHORDS[3].stab, 0.14, 0.75, { cutoff: 6500, end: 1500 }));
  const pops = [81, 85, 88, 90, 93, 97];
  [0.02, 0.2, 0.36, 0.52, 0.7, 0.95].forEach((d, k) => { s.pop(lv(3, d), 0.9, { f0: 700 + k * 80, f1: 1400 + k * 110, pan: k === 5 ? 0.6 : 0.35 }); s.bell(lv(3, d), pops[k], 0.35, { pan: 0.35, hall: 0.25, dur: 0.6 }); });
  s.pop(lv(3, 1.15), 1.0, { f0: 1200, f1: 2300, pan: 0.5 });
  [[1, 76], [1.25, 76], [2, 78], [2.25, 78], [3, 81]].forEach(([q, m], k) => s.chop(lb(3, q), m, BEAT * 0.18, 0.75, { vowel: 'a', pan: k % 2 ? 0.35 : -0.35, delay: 0.12 }));
  s.tabla(lb(3, 1.75), 'tin', 0.35); s.tabla(lb(3, 3.75), 'tin', 0.4, { pan: -0.3 });
  s.whoosh(lv(3, 2.12), 0.25, 0.6, { f0: 250, f1: 4200, p0: 0.6, p1: 0 });

  // bar 5 — MIX: heard through the wall, then the filter opens; four on the
  // floor, scratches, the neighbour's knocks in time, and a build into the hit.
  drums(s, 4, r);
  s.wall.frequency.setValueAtTime(20000, T.lines[4] - 0.05);
  s.wall.frequency.setValueAtTime(420, T.lines[4]);
  s.wall.frequency.setValueAtTime(420, lb(4, 0.4));
  s.wall.frequency.exponentialRampToValueAtTime(18000, lb(4, 0.75));
  for (let q = 0; q < 4; q += 0.5) s.bass(lb(4, q), q % 1 ? 47 : 35, BEAT * 0.35, q % 1 ? 0.7 : 0.95);
  [0, 2].forEach((q) => s.supersaw(lb(4, q), CHORDS[4].stab.map((m) => m + 12), 0.22, 0.6, { cutoff: 7000, end: 1600 }));
  HOOK.forEach(([q, m, d], k) => { s.chop(lb(4, q), m, BEAT * d * 0.9, 0.75, { vowel: 'a', pan: k % 2 ? 0.2 : -0.2 }); s.pluck(lb(4, q), m + 12, 0.18, { out: s.music, hall: 0.2, delay: 0.1, dur: 0.8 }); });
  s.playBuffer(lb(4, 0.75), s.scratchBuffer(0.3, 2.5), 0.28, { out: s.fx, room: 0.2 });
  [1.0, 1.25, 1.5].forEach((q) => s.knock(lb(4, q), 1)); // the neighbour, right before their note lands
  // the record flips to Boat Club Bistro on beat 3: backspin, then the slam
  s.playBuffer(lb(4, 1.7), s.scratchBuffer(0.28, 1.5), 0.32, { out: s.fx, room: 0.25 });
  s.reverseSwell(lb(4, 2), BEAT * 0.5, 0.6);
  s.boom(lb(4, 2), 0.7, { f0: 60, f1: 32, dur: 0.9 });
  s.crash(lb(4, 2), 0.22, { dur: 1.2 });
  s.supersaw(lb(4, 2), [59, 62, 66, 71, 74], 0.5, 0.9, { cutoff: 8000, end: 1200, voices: 7, hall: 0.3 });
  [2.5, 3, 3.5].forEach((q) => s.clap(lb(4, q), 0.45, { room: 0.3 }));
  for (let k = 0; k < 8; k++) s.snare(lb(4, 3 + k / 8), 0.14 + k * 0.05, { tone: 190 + k * 12, decay: 0.07 });
  s.sweep(lb(4, 2), T.climax, [59, 66, 71], 0.9);
  // build: open hats on the off-beats, then a stuttering vocal chop climbing into the hit
  // the whole groove leans in over the last two beats
  for (const bus of [s.drums, s.music]) { bus.gain.setValueAtTime(1, lb(4, 2)); bus.gain.linearRampToValueAtTime(1.3, T.climax - 0.02); bus.gain.setValueAtTime(1, T.climax); }
  [2.5, 3.5].forEach((q) => s.hat(lb(4, q), 0.16, true, 0.1));
  const stut = [[2.5, 71], [2.75, 71], [3, 74], [3.125, 74], [3.25, 76], [3.375, 76], [3.5, 78], [3.5625, 78], [3.625, 81], [3.6875, 81], [3.75, 83], [3.8125, 83], [3.875, 86], [3.9375, 86]];
  stut.forEach(([q, m], k) => s.chop(lb(4, q), m, BEAT * (q < 3 ? 0.2 : q < 3.5 ? 0.11 : 0.055), 0.55 + k * 0.02, { vowel: 'a', pan: k % 2 ? 0.45 : -0.45, delay: 0.05, hall: 0.15 }));
  [3, 3.5].forEach((q) => s.supersaw(lb(4, q), CHORDS[4].stab.map((m) => m + 12), 0.12, 0.7, { cutoff: 7500, end: 2000 }));
  s.whoosh(lv(4, 2.1), 0.3, 0.55, { f0: 400, f1: 5000, p0: 0.3, p1: -0.3 });
}

// ---- climax (kept: the "GIVE IT A MIC" hit) ------------------------------------
function climax(s) {
  const [w1, w2, w3, w4] = T.climaxWords;
  const g = [59, 62, 67, 71];
  [w1, w2, w3].forEach((t, i) => {
    s.kick(t, 0.85 + i * 0.05);
    duckAt(s, t, 0.35, 0.05);
    s.supersaw(t, g.map((m) => m + (i === 2 ? 2 : 0)), 0.13, 1.0, { cutoff: 7000, end: 1600 });
    s.bass(t, 31 + (i === 2 ? 2 : 0), 0.13, 0.9);
    s.snare(t, 0.35 + i * 0.1, { tone: 200 + i * 20 });
  });
  s.reverseSwell(w4, 0.22, 0.7);
  s.kick(w4, 1.0, { decay: 0.5 });
  duckAt(s, w4, 0.3, 0.25);
  s.boom(w4, 1.0, { f0: 58, f1: 29, dur: 1.4 });
  s.crash(w4, 0.34, { dur: 1.8 });
  s.supersaw(w4, [57, 61, 64, 69, 73], 0.95, 1.1, { cutoff: 8000, end: 700, voices: 7, hall: 0.35 });
  s.bass(w4, 33, 0.9, 1.0);
  s.chop(w4, 81, BEAT * 1.2, 0.6, { vowel: 'a', hall: 0.5, delay: 0.3 });
  const t0 = w4 + BEAT, roll = [];
  for (let t = t0; t < t0 + BEAT * 0.5; t += BEAT / 4) roll.push(t);
  for (let t = t0 + BEAT * 0.5; t < t0 + BEAT; t += BEAT / 8) roll.push(t);
  for (let t = t0 + BEAT; t < T.endHit - 0.01; t += BEAT / 16) roll.push(t);
  roll.forEach((t, i) => s.snare(t, 0.18 + (i / roll.length) * 0.5, { tone: 170 + i * 6, decay: 0.09 }));
  s.riser(w4 + 0.35, T.endHit, 0.8);
  s.reverseSwell(T.endHit, 0.45, 0.8);
}

// ---- outro -----------------------------------------------------------------------
function outro(s) {
  const E = T.end, D = T.endDesign;
  const Rn = [...E, T.fadeOut[0]], Dn = [...D];
  // design-time offset d inside card k, mapped to real time
  const e = (k, d) => Rn[k] + d * (Rn[k + 1] - Rn[k]) / (Dn[k + 1] - Dn[k]);
  const t = T.endHit;
  s.kick(t, 1.0, { decay: 0.6 });
  s.boom(t, 1.0, { f0: 55, f1: 27, dur: 2.6, hall: 0.25 });
  s.crash(t, 0.32, { dur: 2.6, hall: 0.4 });
  s.supersaw(t, [50, 57, 62, 66, 69, 74], 2.0, 0.42, { cutoff: 6500, end: 520, out: s.airy, voices: 7, hall: 0.5, attack: 0.01 });
  s.pad(t, T.fadeOut[1] - 0.3, [38, 50, 57, 62, 66, 69], 0.7, { attack: 0.5, cutoff: 1400, release: 0.8 });
  s.tanpura(t + 0.2, T.fadeOut[1] - 0.3, 0.65, { cycle: BEAT * 4 });
  s.bass(t, 26, 1.4, 0.6);
  [[0.06, 86], [0.14, 90], [0.22, 93], [0.3, 98]].forEach(([d, m], i) => s.bell(t + d, m, 0.9, { pan: (i - 1.5) * 0.3 }));
  s.whoosh(t + 0.03, 0.36, 0.3, { f0: 800, f1: 8000, p0: -0.4, p1: 0.4 });
  // a pulse under the cards keeps the momentum going
  for (let tt = E[1]; tt < E[5] - 0.05; tt += BEAT) {
    const beat = Math.round((tt - E[1]) / BEAT) % 4;
    if (beat === 0 || beat === 2) s.kick(tt, beat === 0 ? 0.55 : 0.38, { decay: 0.3, click: 0.1 });
    s.hat(tt + BEAT / 2, 0.06, false, 0.2);
    if (beat === 1 || beat === 3) s.tabla(tt, 'na', 0.18, { pan: 0.25 });
    if (beat === 0) s.bass(tt, 38, BEAT * 1.8, 0.45);
  }
  // SHADES / presents
  [0.55, 0.62, 0.69, 0.76].forEach((d, i) => s.pluck(e(0, d), [74, 78, 81, 86][i], 0.4, { pan: (i - 1.5) * 0.25, hall: 0.45, delay: 0.2 }));
  // OPEN MIC
  s.boom(e(1, 0.05), 0.55, { f0: 50, f1: 32, dur: 1.3, hall: 0.3 });
  s.whoosh(E[1] - 0.18, 0.24, 0.35, { f0: 300, f1: 3000, p0: 0, p1: 0 });
  s.supersaw(e(1, 0.08), [55, 62, 67, 71], 1.0, 0.32, { cutoff: 4000, end: 700, out: s.airy, hall: 0.5 });
  s.chop(e(1, 0.1), 78, BEAT, 0.5, { vowel: 'o', hall: 0.6, delay: 0.3, out: s.airy });
  // who it's for, one note each
  [74, 76, 78, 81, 83].forEach((m, k) => { s.pluck(e(2, 0.22 + k * 0.15), m, 0.45, { pan: (k - 2) * 0.25, hall: 0.4, delay: 0.15 }); s.tabla(e(2, 0.22 + k * 0.15), 'na', 0.2, { pan: (k - 2) * 0.2 }); });
  s.whoosh(E[2] - 0.13, 0.2, 0.25, { f0: 400, f1: 3000, p0: -0.3, p1: 0.3 });
  // the date rolls in
  for (let d = 0.12; d < 0.8; d += 0.035) s.click(e(3, d), 0.1, { f: 3000, room: 0.1 });
  s.boom(e(3, 0.6), 0.4, { f0: 55, f1: 40, dur: 0.8, hall: 0.3 });
  s.whoosh(E[3] - 0.13, 0.2, 0.25, { f0: 400, f1: 3000, p0: 0.3, p1: -0.3 });
  // the venue, and the river
  s.texture(e(4, 0.2), E[5], { v: 0.08, f: [320, 1300], q: 0.8, lfo: 3, seed: 21, gainCurve: [0, 0.8, 1, 0.6] });
  s.pop(e(4, 1.1), 0.8, { f0: 700, f1: 1400 });
  s.whoosh(E[4] - 0.13, 0.2, 0.25, { f0: 400, f1: 3000, p0: -0.3, p1: 0.3 });
  // lockup
  s.kick(E[5], 0.85, { decay: 0.5 });
  s.boom(E[5], 0.8, { f0: 55, f1: 27, dur: 2.2, hall: 0.3 });
  s.supersaw(E[5], [50, 57, 62, 66, 69, 74, 78], 1.8, 0.35, { cutoff: 6000, end: 500, out: s.airy, voices: 7, hall: 0.6 });
  [0.3, 0.42, 0.54].forEach((d, i) => s.bell(e(5, d), [86, 90, 93][i], 0.8, { pan: (i - 1) * 0.4 }));
  s.texture(E[5], T.fadeOut[1] - 0.1, { v: 0.08, f: [320, 1300], q: 0.8, lfo: 3, seed: 23, gainCurve: [0, 0.8, 1, 0.8, 0.5, 0] });
  s.master.gain.setValueAtTime(0.9, T.fadeOut[0]);
  s.master.gain.linearRampToValueAtTime(0.0, T.duration);
}
