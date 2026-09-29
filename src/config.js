// Event copy, palette and the master cue sheet shared by visuals and audio.

export const EVENT = {
  host: 'SHADES',
  title: 'OPEN MIC',
  day: 'SAT',
  date: '24 OCT 2026',
  dateShort: '24.10.26',
  venue: 'Boat Club Bistro',
  city: 'Roorkee',
  coords: '29.87°N 77.89°E',
  roles: ['Poets', 'Musicians', 'Storytellers', 'Stand-up', 'DJs'],
};

export const COPY = {
  intro: [
    { pre: 'The river ', verb: 'hums', post: '.' },
    { pre: 'The wind ', verb: 'recites', post: '.' },
    { pre: 'The leaves ', verb: 'applaud', post: '.' },
  ],
  turn: ['Your', 'turn.'],
  lines: [
    { key: 'POEM', tail: 'still in your notes app.', label: 'POETS' },
    { key: 'SONG', tail: 'only your shower has heard.', label: 'MUSICIANS' },
    { key: 'STORY', tail: 'you only tell at 2 AM.', label: 'STORYTELLERS' },
    { key: 'JOKE', tail: 'your group chat still quotes.', label: 'STAND-UP' },
    { key: 'MIX', tail: 'your neighbours know by heart.', label: 'DJs' },
  ],
  climax: ['GIVE', 'IT', 'A', 'MIC'],
};

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

export const BPM = 120;
export const BEAT = 60 / BPM;

// Master cue sheet (seconds).
export const T = {
  duration: 16.5,
  dropFall: 0.06,
  impact: 0.34,
  introIn: [0.78, 2.06, 3.32],
  introOut: [1.84, 3.08, 4.20],
  leaves: [3.0, 4.95],
  push: [4.28, 5.22],
  turn: 4.80,
  taps: [5.08, 5.28],
  drop: 5.5,
  lines: [5.5, 6.5, 7.5, 8.5, 9.5],
  climax: 10.5,
  climaxWords: [10.5, 10.625, 10.75, 11.0],
  endHit: 12.0,
  endLock: 12.62,
  fadeOut: [15.95, 16.5],
};

export const beatTime = (b) => T.drop + b * BEAT;
