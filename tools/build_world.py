"""Slices the generated tileset / prop / UI sheets into game-ready atlases.

usage: python3 tools/build_world.py <dir with tiles_*.png, props_*.png, ui_*.png> public
Writes public/world/tiles_<theme>.png (8x8 atlas of 64px tiles), public/world/props_<theme>.png (+ src/lib/world/props_<theme>.json),
public/ui/icons.png, public/ui/frames.png.
"""
import json, os, sys
import numpy as np
from scipy import ndimage as ndi
from PIL import Image

SRC, OUT = sys.argv[1], sys.argv[2]
TILE = 64
THEMES = ["grass", "cave", "swamp", "ice", "guild"]


def key(img):
    """Magenta background -> transparent, with the pink fringe un-mixed from edge pixels."""
    a = np.asarray(img.convert("RGB")).astype(np.float32)
    mag = np.array([255, 0, 255], np.float32)
    d = np.linalg.norm(a - mag, axis=2)
    alpha = np.clip((d - 110) / 80, 0, 1)
    out = a.copy()
    m = (alpha > 0) & (alpha < 1)
    out[m] = np.clip((a[m] - (1 - alpha[m, None]) * mag) / np.maximum(alpha[m, None], 0.05), 0, 255)
    return Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), "RGBA")


def tiles(theme):
    im = Image.open(f"{SRC}/tiles_{theme}.png").convert("RGB")
    W = im.width / 8
    atlas = Image.new("RGBA", (8 * TILE, 8 * TILE))
    for r in range(8):
        for c in range(8):
            box = (round(c * W), round(r * W), round((c + 1) * W), round((r + 1) * W))
            t = im.crop(box).resize((TILE, TILE), Image.LANCZOS).convert("RGBA")
            if r == 7:  # overlay row: sits on top of other tiles
                t = key(im.crop(box).resize((TILE * 2, TILE * 2), Image.LANCZOS)).resize((TILE, TILE), Image.LANCZOS)
            atlas.paste(t, (c * TILE, r * TILE))
    atlas.save(f"{OUT}/world/tiles_{theme}.png", optimize=True)


def props(theme, scale=0.55):
    """Objects are found by connected blobs (not a fixed grid), then ordered left-to-right, top-to-bottom."""
    im = Image.open(f"{SRC}/props_{theme}.png").convert("RGB")
    keyed = key(im)
    arr = np.array(keyed)
    solid = arr[..., 3] > 40
    lab, n = ndi.label(ndi.binary_dilation(solid, iterations=3))
    rows = 6 if theme == "guild" else 5
    band = im.height / rows
    found = []
    for i, sl in enumerate(ndi.find_objects(lab), start=1):
        m = (lab[sl] == i) & solid[sl]
        if m.sum() < 400:
            continue
        piece = arr[sl].copy()
        piece[~(lab[sl] == i)] = 0
        img = Image.fromarray(piece, "RGBA")
        img = img.crop(img.getbbox())
        cy, cx = (sl[0].start + sl[0].stop) / 2, (sl[1].start + sl[1].stop) / 2
        found.append((min(rows - 1, int(cy // band)), cx, img))
    found.sort(key=lambda f: (f[0], f[1]))
    cells = [f[2].resize((max(1, round(f[2].width * scale)), max(1, round(f[2].height * scale))), Image.LANCZOS) for f in found]
    print(theme, sum(1 for c in cells if c.width > 1), "of", len(cells), "objects")
    x = y = rowh = 0
    AW = 1024
    place = []
    for cimg in cells:
        if x + cimg.width > AW:
            x, y, rowh = 0, y + rowh + 2, 0
        place.append({"x": x, "y": y, "w": cimg.width, "h": cimg.height})
        x += cimg.width + 2
        rowh = max(rowh, cimg.height)
    atlas = Image.new("RGBA", (AW, y + rowh + 2))
    for cimg, p in zip(cells, place):
        atlas.paste(cimg, (p["x"], p["y"]))
    atlas.save(f"{OUT}/world/props_{theme}.png", optimize=True)
    from PIL import ImageDraw
    dbg = Image.new("RGBA", atlas.size, (70, 90, 70, 255))
    dbg.alpha_composite(atlas)
    d = ImageDraw.Draw(dbg)
    for i, pl in enumerate(place):
        cx, cy = pl["x"] + pl["w"] // 2 - 8, pl["y"] + pl["h"] // 2 - 6
        d.rectangle((cx - 2, cy - 1, cx + 20, cy + 12), fill=(0, 0, 0, 255))
        d.text((cx, cy), str(i), fill=(255, 255, 0, 255))
    dbg.convert("RGB").save(f"/tmp/claude-0/dbg_{theme}.png")
    os.makedirs("src/lib/world", exist_ok=True)
    json.dump(place, open(f"src/lib/world/props_{theme}.json", "w"))


for t in THEMES:
    tiles(t)
    props(t)
# UI
Image.open(f"{SRC}/ui_icons.png").convert("RGB").pipe if False else None
key(Image.open(f"{SRC}/ui_icons.png")).resize((768, 640), Image.LANCZOS).save(f"{OUT}/ui/icons.png", optimize=True)
fr = [f for f in os.listdir(SRC) if f.startswith("GPT Image") or f.startswith("ui_frames")]
if fr:
    key(Image.open(f"{SRC}/{fr[0]}")).save(f"{OUT}/ui/frames.png", optimize=True)
print("ok")
