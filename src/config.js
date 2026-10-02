// Event copy, palette and the master cue sheet shared by visuals and audio.

export const EVENT = {
  host: 'SHADES',
  title: 'OPEN MIC',
  day: 'SAT',
  dayLong: 'SATURDAY',
  date: '24 OCT 2026',
  dateShort: '24.10.26',
  venue: 'Boat Club Bistro',
  city: 'Roorkee',
  roles: ['Poets', 'Musicians', 'Storytellers', 'Stand-up comics', 'DJs'],
};

// Segments: [text, style] with style r = roman, i = italic accent, d = red full stop.
// "it" is never named in the opening; the film names it, then gives it a mic.
export const COPY = {
  nature: [
    [[['It starts ', 'r'], ['small', 'i'], ['.', 'd']]],
    [[['Then it gets ', 'r'], ['loud', 'i'], ['.', 'd']]],
    [[['It keeps you ', 'r'], ['up', 'i'], ['.', 'd']]],
    [[['You keep it ', 'r'], ['quiet', 'i'], ['.', 'd']]],
  ],
  why: [['Not ', 'r'], ['anymore', 'i'], ['.', 'd']],
  lines: [
    { key: 'POEM', tail: 'still in your notes app.', label: 'POETS' },
    { key: 'SONG', tail: 'only your shower has heard.', label: 'MUSICIANS' },
    { key: 'STORY', tail: 'you only tell at *2 AM*.', label: 'STORYTELLERS' },
    { key: 'JOKE', tail: 'your group chat still quotes.', label: 'STAND-UP' },
    { key: 'MIX', tail: 'your neighbours know by heart.', label: 'DJs' },
  ],
};

// Boat Club Bistro brand colours (sampled from their logo).
export const BCB = { tan: '#DDB788', green: '#1E3C30', deep: '#132A21' };

export const C = {
  red: '#D8260F',
  redHot: '#EC3A1C',
  redDeep: '#5E0A03',
  cream: '#F4EDE0',
  paper: '#EFE6D4',
  ink: '#0C0A09',
  night: '#0B0E27',
  nightDeep: '#05061A',
  gold: '#F5C37A',
  white: '#FFFFFF',
};

export const BPM = 110;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

// The opening is counted in beats from the droplet's impact, so every cut,
// strike and flash lands on the grid the groove later plays on.
const IMPACT = 0.4;
const nb = (b) => IMPACT + b * BEAT;
const DROP = nb(18);
const CLIMAX = DROP + 5 * BAR;
const END_HIT = CLIMAX + BAR;
// End cards are animated in "design" seconds (endDesign) and warped onto the
// real timeline (end), so they can be retimed without touching their motion.
const END_DUR = [1.3, 1.1, 2.0, 1.55, 1.65, 1.8];
const END = END_DUR.reduce((a, d) => [...a, a[a.length - 1] + d], [END_HIT]);

export const T = {
  duration: END[6] + 0.5,
  dropFall: 0.06,
  impact: IMPACT,
  shots: [0, nb(4), nb(8)],
  textIn: [0.6, nb(4) + 0.1, nb(8) + 0.16, nb(12) + 0.1],
  textOut: [nb(4) - 0.3, nb(8) - 0.34, nb(12) - 0.2, nb(14.5)],
  lightning: [nb(5), nb(7)],
  sync: nb(10),
  dawn: [nb(11.2), nb(13.2)],
  flock: nb(12.2),
  push: [nb(15), nb(16.6)],
  why: nb(15.4),
  taps: [nb(16.5), nb(17)],
  drop: DROP,
  lines: [0, 1, 2, 3, 4].map((i) => DROP + i * BAR),
  climax: CLIMAX,
  climaxWords: [0, 1, 2, 3].map((i) => CLIMAX + (i * BEAT) / 2),
  endHit: END_HIT,
  end: END.slice(0, 6),
  endDesign: [26.4, 28.0, 29.6, 31.9, 33.8, 35.8, 37.7],
  fadeOut: [END[6], END[6] + 0.5],
};

/** Real end-sequence time -> design time used by the end cards. */
export function endDesignTime(t) {
  const R = [...T.end, T.fadeOut[0], T.fadeOut[1]];
  const D = [...T.endDesign, T.endDesign[6] + 0.6];
  if (t <= R[0]) return D[0] + (t - R[0]);
  for (let i = 0; i < R.length - 1; i++) {
    if (t <= R[i + 1]) return D[i] + ((t - R[i]) / (R[i + 1] - R[i])) * (D[i + 1] - D[i]);
  }
  return D[D.length - 1] + (t - R[R.length - 1]);
}

// Groove hits shared by the score and the picture (kick punches, snare flashes).
// Beats within each line bar.
export const GROOVE = [
  { kick: [0, 0.75, 1.5, 2, 3], snare: [1, 3], feel: 'drop' }, // POEM
  { kick: [0, 1.5, 2, 2.75], snare: [1, 3], feel: 'bounce' }, // SONG
  { kick: [0, 2.5], snare: [2], feel: 'half' }, // STORY (2 AM half-time)
  { kick: [0, 0.75, 1.5, 2, 2.5, 3.25], snare: [1, 3], feel: 'bounce' }, // JOKE
  { kick: [0, 1, 2, 3], snare: [1, 3], feel: 'four' }, // MIX
];
export const grooveHits = (kind) => GROOVE.flatMap((g, i) => g[kind].map((q) => DROP + i * BAR + q * BEAT));

export const beatTime = (b) => DROP + b * BEAT;
