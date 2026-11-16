"""Turn a generated NPC sheet (magenta background, 6 frames across x 3 rows: front, left, right) into public/npc/<name>.png
and register its frame size in src/components/npc/npcs.json.  Usage: python3 tools/build_npc.py <name> <sheet.png>"""
import json, sys
import numpy as np
from PIL import Image

def key(img):
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    mag = np.array([255, 0, 255], np.float32)
    d = np.linalg.norm(a - mag, axis=2)
    alpha = np.clip((d - 110) / 80, 0, 1)
    out = a.copy()
    m = (alpha > 0) & (alpha < 1)
    out[m] = np.clip((a[m] - (1 - alpha[m, None]) * mag) / np.maximum(alpha[m, None], 0.05), 0, 255)
    return Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), "RGBA")

name, src = sys.argv[1], sys.argv[2]
COLS, ROWS = 6, 3
im = key(Image.open(src))
W, H = im.size
cw, ch = W // COLS, H // ROWS
cells = [[im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch)) for c in range(COLS)] for r in range(ROWS)]
# One box for every frame so the loop doesn't jitter: the union of what is drawn, centred on the feet.
x0, y0, x1, y1 = cw, ch, 0, 0
for row in cells:
    for c in row:
        b = c.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        if b: x0, y0, x1, y1 = min(x0, b[0]), min(y0, b[1]), max(x1, b[2]), max(y1, b[3])
pad = 3
box = (max(0, x0 - pad), max(0, y0 - pad), min(cw, x1 + pad), min(ch, y1 + pad))
fw, fh = box[2] - box[0], box[3] - box[1]
sheet = Image.new("RGBA", (fw * COLS, fh * ROWS))
for r, row in enumerate(cells):
    for c, cell in enumerate(row):
        sheet.paste(cell.crop(box), (c * fw, r * fh))
sheet.save(f"public/npc/{name}.png", optimize=True)
p = "src/components/npc/npcs.json"
d = json.load(open(p))
d[name] = {"w": fw, "h": fh, "rows": ROWS}
json.dump(d, open(p, "w"), indent=1)
print(name, fw, fh, sheet.size)
