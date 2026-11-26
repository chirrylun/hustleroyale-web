"""Build NPC sheets (public/npc/<name>.png + src/components/npc/npcs.json) from loosely laid out character sheets on magenta.
Each NPC takes one row for the front idle and one row of side-facing frames (mirrored for the other side). Every NPC is scaled so its
idle body is the same height as a player's (122 px on a 208 px cell), recorded as `body` so scenes can size NPCs from the player's size.
    python3 tools/build_npc_sheet.py [name ...]"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ATT = Path("/mnt/user-data/attachments/9671d84d-5f23-51d2-a36c-ab3575579987")
# name: (file, front row, side row, side faces, frames to skip at the start of the side row, front frame count)
CFG = {
    "merchant": ("42595c04-image.jpg", 0, 2, "right", 0),
    "secretary": ("3ea29f67-image.jpg", 0, 2, "right", 0),
    "guard": ("7d564784-image.jpg", 0, 2, "right", 0),
    "class_changer": ("35f45cf2-image.jpg", 0, 1, "left", 1),
    "storage_keeper": ("5c68457f-image.jpg", 1, 3, "right", 0),
    "alchemist": ("251900e9-image.jpg", 0, 2, "right", 0),
    "manager": ("736eb98a-image.jpg", 0, None, None, 0),
    "blacksmith": ("c0c64256-image.jpg", 0, 2, "right", 0),
    "trainer": ("/mnt/user-data/attachments/82dfff77-ab7d-53a6-966d-45ff52140262/90542c5c-image.jpg", 0, 2, "left", 0),
}
BODY = 122  # a player's idle body height on a 208 px cell

def load(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    d = np.linalg.norm(a - np.array([242, 0, 242], np.float32), axis=2)
    alpha = np.clip((d - 90) / 70, 0, 1)
    out = a.copy(); m = (alpha > 0) & (alpha < 1)
    out[m] = np.clip((a[m] - (1 - alpha[m, None]) * [242, 0, 242]) / np.maximum(alpha[m, None], .05), 0, 255)
    return Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), "RGBA"), alpha > 0.4

def rows_of(mask):
    prof = ndi.binary_dilation(mask, iterations=4).sum(1) > 0
    lab, k = ndi.label(prof)
    r = [(s[0].start, s[0].stop) for s in ndi.find_objects(lab) if s[0].stop - s[0].start > 80]
    if len(r) != 6:  # rows touching each other: cut the sheet in even sixths
        H = mask.shape[0]; r = [(round(i * H / 6), round((i + 1) * H / 6)) for i in range(6)]
    return r

def frames(mask, y0, y1):
    lab, k = ndi.label(ndi.binary_dilation(mask[y0:y1], iterations=7))
    boxes = []
    for ys, xs in ndi.find_objects(lab):
        if (xs.stop - xs.start) * (ys.stop - ys.start) > 2500: boxes.append((xs.start, ys.start + y0, xs.stop, ys.stop + y0))
    out = []  # a spark, ring or floating gem near a figure belongs to that figure's frame
    for b in sorted(boxes, key=lambda b: -(b[2] - b[0]) * (b[3] - b[1])):
        for i, o in enumerate(out):
            if o[0] - 10 <= (b[0] + b[2]) / 2 <= o[2] + 10:
                out[i] = (min(o[0], b[0]), min(o[1], b[1]), max(o[2], b[2]), max(o[3], b[3])); break
        else: out.append(b)
    return sorted(out)

def build(name):
    f, fr, sr, face, skip = CFG[name]
    im, mask = load(ATT / f)  # an absolute path replaces the folder
    rows = rows_of(mask)
    fb = frames(mask, *rows[fr])[:6]
    crop = lambda b: (lambda c: c.crop(c.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()))(im.crop(b))
    front = [crop(b) for b in fb]
    if sr is None: sets = [front]
    else:
        side = [crop(b) for b in frames(mask, *rows[sr])[skip:skip + 6]]
        if face == "left": left, right = side, [c.transpose(Image.FLIP_LEFT_RIGHT) for c in side]
        else: right, left = side, [c.transpose(Image.FLIP_LEFT_RIGHT) for c in side]
        sets = [front, left, right]
    body = float(np.median([c.height for c in front]))  # idle body height in this sheet's pixels
    fw = max(c.width for r in sets for c in r) + 6; fh = max(c.height for r in sets for c in r) + 6
    sheet = Image.new("RGBA", (fw * 6, fh * len(sets)))
    for r, row in enumerate(sets):
        for i in range(6):
            c = row[i % len(row)]
            sheet.paste(c, (i * fw + (fw - c.width) // 2, r * fh + fh - 3 - c.height))
    sheet.save(f"public/npc/{name}.png", optimize=True)
    p = "src/components/npc/npcs.json"; j = json.load(open(p))
    j[name] = {"w": fw, "h": fh, "rows": len(sets), "body": round(body)}
    json.dump(j, open(p, "w"), indent=1)
    print(name, "rows", [(len(frames(mask, *r))) for r in rows], "front", len(front), "->", sheet.size, "body", round(body))

for n in (sys.argv[1:] or CFG): build(n)
