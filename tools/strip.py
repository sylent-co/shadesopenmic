# Thumbnail grid of rendered frames: python tools/strip.py frames_dir fps t0 t1 step cols out.png
import sys, os
from PIL import Image, ImageDraw
d, fps, t0, t1, step, cols, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5]), int(sys.argv[6]), sys.argv[7]
ts = []
t = t0
while t <= t1 + 1e-9:
    ts.append(round(t, 3)); t += step
tw = 300
ims = []
for t in ts:
    f = os.path.join(d, f"f_{int(round(t * fps)):05d}.png")
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGB'); im = im.resize((tw, int(im.height * tw / im.width)), Image.LANCZOS); ims.append((t, im))
th = ims[0][1].height
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * (tw + 4) + 4, rows * (th + 16) + 4), (25, 25, 25))
dr = ImageDraw.Draw(sheet)
for i, (t, im) in enumerate(ims):
    x = 4 + (i % cols) * (tw + 4); y = 4 + (i // cols) * (th + 16)
    sheet.paste(im, (x, y + 12)); dr.text((x + 2, y), f"{t:.2f}s", fill=(230, 230, 230))
sheet.save(out)
