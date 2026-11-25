"""Build an NPC sheet from a loosely laid-out character sheet (magenta bg): first row -> front idle, second row -> right, its mirror -> left.
Usage: python3 tools/build_npc_loose.py <name> <sheet> <frontRowY0> <frontRowY1> <sideRowY0> <sideRowY1>"""
import json, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
sys.argv += []
name, src = sys.argv[1], sys.argv[2]
ya = [int(v) for v in sys.argv[3:7]]
a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
d = np.linalg.norm(a - np.array([255, 0, 255], np.float32), axis=2)
alpha = np.clip((d - 110) / 80, 0, 1)
out = a.copy(); m = (alpha > 0) & (alpha < 1)
out[m] = np.clip((a[m] - (1 - alpha[m, None]) * [255, 0, 255]) / np.maximum(alpha[m, None], .05), 0, 255)
im = Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), "RGBA")
mask = alpha > 0.4
def frames(y0, y1, n=6):
    band = mask[y0:y1]
    lab, k = ndi.label(ndi.binary_dilation(band, iterations=6))
    boxes = []
    for sl in ndi.find_objects(lab):
        ys, xs = sl
        if (xs.stop - xs.start) * (ys.stop - ys.start) > 1500: boxes.append((xs.start, ys.start + y0, xs.stop, ys.stop + y0))
    boxes.sort()
    # merge boxes whose centres are close (small bits like the sweat mark)
    return boxes[:n]
rows = [frames(ya[0], ya[1]), frames(ya[2], ya[3])]
print([len(r) for r in rows])
def crop(b):
    c = im.crop(b); bb = c.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox(); return c.crop(bb)
cells = [[crop(b) for b in r] for r in rows]
cells.append([c.transpose(Image.FLIP_LEFT_RIGHT) for c in cells[1]])  # row 2 faces right; mirror for left
cells = [cells[0], cells[2], cells[1]]  # front, left, right
fw = max(c.width for r in cells for c in r) + 6; fh = max(c.height for r in cells for c in r) + 6
sheet = Image.new("RGBA", (fw * 6, fh * 3))
for r, row in enumerate(cells):
    for i in range(6):
        c = row[i % len(row)]
        sheet.paste(c, (i * fw + (fw - c.width) // 2, r * fh + fh - 3 - c.height))  # feet on a shared baseline, centred
sheet.save(f"public/npc/{name}.png", optimize=True)
p = "src/components/npc/npcs.json"; j = json.load(open(p)); j[name] = {"w": fw, "h": fh, "rows": 3}
json.dump(j, open(p, "w"), indent=1); print(name, fw, fh)
