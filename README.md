# SHADES — Open Mic · Trailer

A 33.2-second trailer for the **SHADES Open Mic** (poets, musicians,
storytellers, stand-up comics and DJs) — **Saturday 24 October 2026, Boat
Club Bistro, Roorkee**.

Everything is generated in the browser with plain JavaScript: the visuals are
WebGL2 shaders plus Canvas 2D typography, and the soundtrack is synthesised
with the Web Audio API (no samples, no TTS, no stock assets).

![Stills from the trailer](docs/stills.jpg)

## Watch

| File | What it is |
| --- | --- |
| `release/SHADES-OpenMic-Trailer-1080p60.mp4` | 1920×1080, 60 fps, H.264 High + AAC 320k, −14 LUFS (YouTube, LinkedIn, screens at the venue) |
| `release/SHADES-OpenMic-Trailer-1080p30.mp4` | Same cut at 30 fps (frame-blended) for platforms that prefer it |
| `release/SHADES-OpenMic-Trailer-1080x1920-30.mp4` | Vertical 9:16 cut, 30 fps (Instagram Reels / Stories, WhatsApp status) |
| `dist/SHADES-OpenMic-Trailer.html` | Single self-contained file — double-click to play the live, real-time version |
| `index.html` | Live version for development (serve the folder, see below) |

Live controls: **Space** play/pause · **←/→** seek · **R** restart · **F**
fullscreen. Add `?portrait` to the URL for the 9:16 frame. Without WebGL2 the
page falls back to playing the rendered MP4.

## The idea

Everyone has a thing they make: a poem, a song, a story, a joke, a mix. The
opening follows that thing through a day in nature without naming it; the
middle names it; the end tells you where to bring it. Everything runs on one
110 BPM grid, so every cut, lightning strike and caption lands on a beat.

| Time | Section |
| --- | --- |
| 0–2.6 s | A droplet lands on the river at golden hour. *It starts small.* |
| 2.6–4.8 s | Monsoon: rain, torn leaves, lightning on the beat, drums arriving. *Then it gets loud.* |
| 4.8–6.5 s | Deodar forest at night; the fireflies flash in sync. *It keeps you up.* |
| 6.5–8.6 s | Time-lapse dawn and a murmuration over the water. *You keep it quiet.* |
| 8.6–10.2 s | The camera pushes into the sun, which becomes the SHADES disc. *Not anymore.* Two mic taps. |
| 10.2–21.1 s | One bar per line: POEM (a notes app) · SONG (written in shower steam) · STORY (the last lit window at 2 AM) · JOKE (the hostel group chat) · MIX (EQ-bar letters on SHADES red, then the record flips to Boat Club Bistro’s colours and emblem). |
| 21.1–23.3 s | **GIVE IT A MIC.** — the full stop becomes the logo. |
| 23.3–33.2 s | End cards, one idea each: SHADES presents → OPEN MIC → who it’s for → 24 OCT → the Boat Club Bistro wordmark, Roorkee → lockup. |

## Run locally

```bash
npm install          # puppeteer-core + esbuild (only needed for tooling)
npm run dev          # static server on http://localhost:5173
```

## Rebuild the deliverables

Requires Chrome/Chromium, ffmpeg and (for font subsetting) fonttools'
`pyftsubset`.

```bash
npm run build                                   # dist/SHADES-OpenMic-Trailer.html
node tools/render.mjs --w=1920 --h=1080 --fps=60 --workers=3   # frames + soundtrack -> dist/*.mp4
node tools/render.mjs --w=960 --h=540 --fps=20 --draft          # quick review draft
node tools/frames.mjs out 5.6 9.9 14.5          # PNG stills at given times
node tools/audio.mjs dist/soundtrack.wav        # soundtrack only (24-bit WAV)
```

Rendering is deterministic: every value is a pure function of time and all
randomness is seeded, so any frame can be re-rendered on its own. Offline
renders average several sub-frame samples for true motion blur. Headless
Chrome needs a software GL backend when there is no GPU; the tools use
`--use-angle=gl-egl --use-gl=angle --disable-gpu-sandbox` (Mesa llvmpipe).
Set `CHROME=/path/to/chrome` to use a different browser binary.

## Editing the copy or event details

All text lives in `src/config.js` (`EVENT` and `COPY`); timings are in the
cue sheet `T` in the same file, shared by the picture and the soundtrack. Key
words re-fit automatically: the Mona Sans width axis is solved so each word
fills the same frame.

## Code map

- `src/gfx/` — WebGL2 pipeline: landscape shader (sky, Himalayan ridges, water
  with droplet rings and sun glitter, the sun that becomes the brand disc),
  compositing, bloom, grade, grain, letterbox.
- `src/scenes/` — `nature.js` (river, monsoon, forest, dawn), `fast.js` (the
  five line scenes + climax), `kit.js` (shared kinetic-type helpers), `end.js`
  (end cards), `fx.js` (glow and blur helpers), `director.js` (timeline + post
  presets), `logo.js` (vector mark traced from the supplied logo).
- `src/audio/` — `synth.js` (voices: drums, bass, supersaw, Karplus–Strong
  santoor-like plucks, tanpura drone, tabla, formant vocal chops, 808, rain,
  thunder, crickets, koel, birds, knocks, mic taps, scratch…),
  `score.js` (arrangement locked to the cue sheet), `engine.js` (offline
  render, BS.1770 loudness normalisation, look-ahead limiter, WAV).
- `tools/` — static server, frame/audio/video renderers, single-file build.

## Credits

- Logos: SHADES, plus the Boat Club Bistro emblem and wordmark (all vectorised from the supplied artwork).
- Typefaces (SIL Open Font License 1.1): Mona Sans (GitHub), Instrument Serif
  (Instrument), JetBrains Mono (JetBrains).
