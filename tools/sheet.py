# Contact sheet: python tools/sheet.py out.jpg cols img1 img2 ...  (THUMB env = thumb width)
import sys, os
from PIL import Image, ImageDraw
out, cols, files = sys.argv[1], int(sys.argv[2]), sys.argv[3:]
w = int(os.environ.get('THUMB', 480))
ims = [Image.open(f).convert('RGB') for f in files]
ims = [im.resize((w, int(im.height * w / im.width)), Image.LANCZOS) for im in ims]
h = max(im.height for im in ims)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w + (cols + 1) * 6, rows * (h + 22) + 6), (30, 30, 30))
d = ImageDraw.Draw(sheet)
for i, (im, f) in enumerate(zip(ims, files)):
    x = 6 + (i % cols) * (w + 6); y = 6 + (i // cols) * (h + 22)
    sheet.paste(im, (x, y + 16))
    d.text((x, y), os.path.basename(f), fill=(220, 220, 220))
sheet.convert('RGB').save(out, quality=85)
