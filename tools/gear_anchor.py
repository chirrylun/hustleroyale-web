"""Re-seats generated weapon and shield sheets on the body, frame by frame.

AI-generated weapon sheets float in the cell: too big, not in the hand. This reads where the body's own sword (and its
grip) and front fist are in every frame of the base sheet, then rescales, rotates and moves the generated item onto them.

  python3 tools/gear_anchor.py <kind> <body sheet> <generated sheet> <out.png>
  kinds: sword | dagger | mace | wand   (held in the sword hand; angle and grip follow the body's sword)
         shield | broadshield           (carried on the front fist)

Sheets are 6 x 6 cells of 208 px on magenta. Item art must be drawn upright-ish with the grip at the bottom (the hilt end).
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CELL, N = 208, 6
LEN = {"sword": 64, "dagger": 42, "mace": 58, "wand": 58}  # grip-to-tip length on the 208 px cell
SHIELD = {"shield": 46, "broadshield": 78}  # height
USED = {0: 4, 1: 6, 2: 5, 3: 5, 4: 2, 5: 2}


def load(path, key=True):
    im = Image.open(path).convert("RGBA")
    if im.size != (CELL * N, CELL * N):
        im = im.resize((CELL * N, CELL * N), Image.NEAREST)
    a = np.asarray(im).copy()
    if key:
        m = (a[..., 0] > 190) & (a[..., 1] < 100) & (a[..., 2] > 190)
        a[m, 3] = 0
    return a


def biggest(mask, rgb=None):
    """The item itself: the piece with the most dark outline pixels (slash trails and sparkles have none)."""
    lab, n = ndi.label(mask, structure=np.ones((3, 3)))
    if not n:
        return mask
    w = ndi.sum(mask & ((rgb.max(2) < 90) if rgb is not None else True), lab, range(1, n + 1))
    return lab == (1 + int(np.argmax(w)))


def body_blade(cell):
    """Hilt end, tip and unit direction (hilt -> tip) of the body's own sword in one base cell."""
    a = cell.astype(int)
    rgb, al = a[..., :3], a[..., 3] > 40
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    m = al & (sat < 0.18) & (mx > 105)
    m[:50] = False  # the face and eyes sit up here
    # keep the thinnest long component (the blade), not shirt highlights
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    best, score = None, 0
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(xs) < 12:
            continue
        ext = max(np.ptp(xs), np.ptp(ys))
        if ext > score:
            best, score = (xs, ys), ext
    if best is None:
        return None
    xs, ys = best
    pts = np.stack([xs, ys], 1).astype(float)
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    d = vt[0]
    proj = (pts - c) @ d
    p0, p1 = c + d * proj.min(), c + d * proj.max()
    body = np.stack(np.nonzero(al)[::-1], 1).mean(0)
    hilt, tip = (p0, p1) if np.linalg.norm(p0 - body) < np.linalg.norm(p1 - body) else (p1, p0)
    v = tip - hilt
    return hilt, v / (np.linalg.norm(v) + 1e-9)


def front_fist(cell):
    """Centre of the front (right-most) bare fist."""
    a = cell.astype(int)
    rgb, al = a[..., :3], a[..., 3] > 40
    ys, xs = np.nonzero(al)
    top, bot = ys.min(), ys.max()
    mx, mn = rgb.max(2), rgb.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    skin = al & (rgb[..., 0] > 190) & (sat > 0.3) & (sat < 0.6) & (rgb[..., 2] < 170)
    lab, n = ndi.label(skin, structure=np.ones((3, 3)))
    cand = []
    for i in range(1, n + 1):
        yy, xx = np.nonzero(lab == i)
        if len(xx) < 8:
            continue
        cy = yy.mean()
        if top + 0.38 * (bot - top) < cy < top + 0.78 * (bot - top):
            cand.append((xx.mean(), cy))
    if not cand:
        return np.array([xs.mean() + 10, top + 0.55 * (bot - top)])
    return np.array(max(cand))


def item_axis(mask, rgb):
    """Grip end and tip end (unit vector grip -> tip) of a generated item."""
    ys, xs = np.nonzero(mask)
    pts = np.stack([xs, ys], 1).astype(float)
    c = pts.mean(0)
    u, s, vt = np.linalg.svd(pts - c, full_matrices=False)
    d = vt[0]
    proj = (pts - c) @ d
    lo, hi = proj.min(), proj.max()
    # the grip end is the narrower end of the item
    w_lo = (proj < lo + 0.25 * (hi - lo)).sum()
    w_hi = (proj > hi - 0.25 * (hi - lo)).sum()
    if w_lo > w_hi:
        d, proj = -d, -proj
        lo, hi = proj.min(), proj.max()
    return c + d * lo, d, hi - lo


def paste(dst, img, cx, cy):
    x0, y0 = int(round(cx - img.width / 2)), int(round(cy - img.height / 2))
    layer = Image.new("RGBA", dst.size, (0, 0, 0, 0))
    layer.paste(img, (x0, y0))
    dst.alpha_composite(layer)


def main():
    kind, base_p, gen_p, out_p = sys.argv[1:5]
    base, gen = load(base_p, key=False), load(gen_p)
    out = Image.new("RGBA", (CELL * N, CELL * N), (255, 0, 255, 255))
    result = Image.new("RGBA", out.size, (0, 0, 0, 0))
    held = kind in LEN
    for r, count in USED.items():
        for c in range(count):
            sl = (slice(r * CELL, (r + 1) * CELL), slice(c * CELL, (c + 1) * CELL))
            g = gen[sl].copy()
            mask = biggest(g[..., 3] > 40, g[..., :3].astype(int))
            if mask.sum() < 20:
                continue
            ys, xs = np.nonzero(mask)
            crop = Image.fromarray(g[ys.min():ys.max() + 1, xs.min():xs.max() + 1]).copy()
            sub = np.asarray(crop).copy(); sub[~mask[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 3] = 0
            crop = Image.fromarray(sub)
            grip0, d0, length = item_axis(mask, g[..., :3])
            cell = base[sl]
            if held:
                bb = body_blade(cell)
                if bb is None:
                    continue
                hilt, d1 = bb
                anchor = hilt - d1 * 6  # the fist sits just behind the guard
                scale = LEN[kind] / length
                ang0, ang1 = np.degrees(np.arctan2(d0[1], d0[0])), np.degrees(np.arctan2(d1[1], d1[0]))
                grip_local = (grip0 - np.array([xs.min(), ys.min()])) * scale
                want = grip_local + 0.12 * LEN[kind] * d0 * 0  # grip = pommel end
            else:
                anchor = front_fist(cell) + np.array([6, -2])
                scale = SHIELD[kind] / crop.height
                ang0 = ang1 = 0
            big = crop.resize((max(1, round(crop.width * scale)), max(1, round(crop.height * scale))), Image.NEAREST)
            if held:
                # rotate about the grip: pad so the grip sits at the image centre, then rotate
                gx, gy = (grip0 - np.array([xs.min(), ys.min()])) * scale
                R = int(max(big.size) * 1.5) + 4
                pad = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0))
                pad.paste(big, (int(R - gx), int(R - gy)))
                pad = pad.rotate(-(ang1 - ang0), resample=Image.NEAREST, center=(R, R))
                layer = Image.new("RGBA", out.size, (0, 0, 0, 0))
                layer.paste(pad, (int(c * CELL + anchor[0] - R), int(r * CELL + anchor[1] - R)))
                result.alpha_composite(layer)
            else:
                paste(result, big, c * CELL + anchor[0], r * CELL + anchor[1])
    out.alpha_composite(result)
    out.convert("RGB").save(out_p)
    print("wrote", out_p)


if __name__ == "__main__":
    main()
