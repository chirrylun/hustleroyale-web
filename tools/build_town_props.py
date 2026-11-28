"""Cuts the generated 6 x 6 props sheets (magenta background) into transparent atlases, one per town.

  python3 tools/build_town_props.py market=path.jpg lobby=path.jpg arena=path.jpg

Writes public/town/props_<id>.png (1254 px square, same scale as the old shared sheet) and props_<id>.json
({w, h, rects}: the tight box of each of the 36 cells). Contact shadows are kept as soft black.
"""
import json, sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

OUT = Path(__file__).resolve().parent.parent / "public" / "town"
SIZE = 1254


def key(im):
    a = np.array(im.convert("RGB")).astype(int)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    pure = (r > 170) & (b > 170) & (g < 120) & (abs(r - b) < 70)
    # shadow-ish: purple with little green, darker than the background, reachable from the background
    dim = (r - g > 40) & (b - g > 40) & (abs(r - b) < 70) & ~pure
    lab, _ = ndi.label(pure | dim)
    touch = np.unique(lab[ndi.binary_dilation(pure, iterations=2) & (pure | dim)])
    touch = touch[touch > 0]
    bg_zone = np.isin(lab, touch)
    shadow = bg_zone & dim
    alpha = np.full(r.shape, 255, np.uint8)
    alpha[bg_zone & pure] = 0
    # shadow strength follows how dark the purple is (darker = more shadow)
    strength = np.clip((255 - (r + b) / 2) / 255 * 1.4, 0, 0.45)
    alpha[shadow] = (strength[shadow] * 255).astype(np.uint8)
    out = np.dstack([a.astype(np.uint8), alpha])
    out[shadow, :3] = (20, 10, 30)
    out[alpha == 0, :3] = 0
    return Image.fromarray(out, "RGBA")


def build(name, path):
    im = key(Image.open(path)).resize((SIZE, SIZE), Image.LANCZOS)
    al = np.array(im)[..., 3]
    cell = SIZE / 6
    rects = []
    for n in range(36):
        r, c = divmod(n, 6)
        x0, y0, x1, y1 = round(c * cell), round(r * cell), round((c + 1) * cell), round((r + 1) * cell)
        solid = al[y0:y1, x0:x1] > 90  # the object itself, not its faint shadow
        ys, xs = np.where(solid)
        if len(xs) == 0:
            rects.append([x0, y0, 1, 1]); continue
        bx0, bx1, by0, by1 = x0 + xs.min(), x0 + xs.max() + 1, y0 + ys.min(), y0 + ys.max() + 1
        # take the soft shadow below the object with it
        sh = al[by0:min(y1, by1 + 14), bx0:bx1] > 8
        yy = np.where(sh.any(axis=1))[0]
        by1 = by0 + (yy.max() + 1 if len(yy) else by1 - by0)
        rects.append([int(bx0), int(by0), int(bx1 - bx0), int(by1 - by0)])
    im.save(OUT / f"props_{name}.png")
    (OUT / f"props_{name}.json").write_text(json.dumps({"w": SIZE, "h": SIZE, "rects": rects}))
    print(name, "ok")


for arg in sys.argv[1:]:
    n, p = arg.split("=", 1)
    build(n, p)
