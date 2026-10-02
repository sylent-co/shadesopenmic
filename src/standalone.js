// Entry for the single-file build: fonts arrive base64-inlined.
import MARK from './scenes/markPath.js';
import { boot } from './player.js';

const b64ToBuf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
window.__EMBEDDED_FONTS__ = Object.fromEntries(Object.entries(window.__FONT_B64__).map(([k, v]) => [k, b64ToBuf(v)]));
document.getElementById('mark').setAttribute('d', MARK);
boot().catch((e) => { document.getElementById('status').textContent = 'Could not start: ' + e.message; console.error(e); });
