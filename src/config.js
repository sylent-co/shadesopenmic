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
export const COPY = {
  nature: [
    [[['The river never ', 'r'], ['rehearses', 'i'], ['.', 'd']]],
    [[['The monsoon never asks', 'r']], [['if it’s too ', 'r'], ['loud', 'i'], ['.', 'd']]],
    [[['Fireflies don’t check', 'r']], [['who’s ', 'r'], ['watching', 'i'], ['.', 'd']]],
    [[['Nothing out here', 'r']], [['waits to be ', 'r'], ['ready', 'i'], ['.', 'd']]],
  ],
  why: [['So why do ', 'r'], ['you', 'i'], ['?', 'd']],
  lines: [
    { key: 'POEM', tail: 'still in your notes app.', label: 'POETS' },
    { key: 'SONG', tail: 'only your shower has heard.', label: 'MUSICIANS' },
    { key: 'STORY', tail: 'you only tell at *2 AM*.', label: 'STORYTELLERS' },
    { key: 'JOKE', tail: 'your group chat still quotes.', label: 'STAND-UP' },
    { key: 'MIX', tail: 'your neighbours know by heart.', label: 'DJs' },
  ],
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

export const BPM = 100;
export const BEAT = 60 / BPM;
export const BAR = BEAT * 4;

// Master cue sheet (seconds).
export const T = {
  duration: 36.5,
  // nature: river (golden hour) -> monsoon -> night forest -> dawn (time-lapse)
  shots: [0, 2.6, 5.2, 7.8],
  dropFall: 0.06,
  impact: 0.34,
  textIn: [0.85, 2.95, 5.6, 8.2],
  textOut: [2.3, 4.85, 7.45, 10.0],
  lightning: [3.72, 4.62],
  sync: 6.75, // fireflies flash together
  dawn: [7.4, 8.7],
  push: [10.25, 11.25],
  why: 10.5,
  taps: [11.3, 11.55],
  drop: 12.0,
  lines: [12.0, 14.4, 16.8, 19.2, 21.6],
  climax: 24.0,
  climaxWords: [24.0, 24.3, 24.6, 24.9],
  endHit: 26.4,
  // end cards: logo, title, roles, date, venue, lockup
  end: [26.4, 28.0, 29.6, 31.2, 32.6, 34.0],
  fadeOut: [35.9, 36.5],
};

export const beatTime = (b) => T.drop + b * BEAT;
