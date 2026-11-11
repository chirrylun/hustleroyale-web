"""Turns AI-generated sprite sheets (flat magenta background) into the game's fixed-grid sheets.

Characters: 6 cols x 6 rows of 208px cells; rows = idle(4) walk(6) attack(5) cast(5) hurt(2) windup(2).
Effects:    4 cols x 4 rows of 96px cells (one effect per row, 4 frames), centred in each cell.
Usage: python tools/build_sprites.py <src-root> <out-dir>   (src-root holds the unzipped sheet folders listed in main)
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

CELL, SCALE, BASE, PAD = 208, 0.56, 188, 160
FXCELL = 96
TARGETS = [("idle", 4), ("walk", 6), ("attack", 5), ("cast", 5), ("hurt", 2)]


def cut_background(path):
    """RGBA with the magenta removed: soft alpha plus colour un-mixing on edge pixels."""
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b)
    mag = m - g
    bgish = (np.abs(r - b) < 70) & (m > 120)
    alpha = np.where(bgish, 1 - np.clip((mag - 70) / 90, 0, 1), 1.0)
    safe = np.maximum(alpha, 0.05)[..., None]
    bg = np.array([255, 0, 255], np.float32)
    col = np.where(alpha[..., None] < 1, (a - (1 - safe) * bg) / safe, a)
    out = np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)
    out[alpha < 0.04] = 0
    return out


def segments(proj, gap, min_len=1, thr=0):
    idx = np.flatnonzero(proj > thr)
    if idx.size == 0:
        return []
    out, start, prev = [], idx[0], idx[0]
    for i in idx[1:]:
        if i - prev > gap:
            out.append((start, prev + 1))
            start = i
        prev = i
    out.append((start, prev + 1))
    return [s for s in out if s[1] - s[0] >= min_len]


def scaled(rgba, s):
    im = Image.fromarray(rgba).convert("RGBa")
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    return im.resize((w, h), Image.LANCZOS).convert("RGBA")


def pick(frames, n, pingpong=False):
    if len(frames) >= n or not pingpong:  # too many: sample evenly; too few: stretch (hold frames) in order
        return [frames[round(i * (len(frames) - 1) / max(1, n - 1))] for i in range(n)]
    seq = frames + frames[-2:0:-1] if pingpong else frames
    return [seq[i % len(seq)] for i in range(n)]


def character(src, dst, tag):
    rgba = cut_background(src)
    solid = rgba[..., 3] > 128
    lab, k = ndi.label(solid)
    if k:
        keep = np.flatnonzero(ndi.sum(solid, lab, range(1, k + 1)) >= 60) + 1
        solid = np.isin(lab, keep)
    rows = segments(solid.sum(1), 10, 20, thr=14)
    if len(rows) != 5:  # glow/sparkles glued rows together: the sheets are laid out in even fifths
        print(f"  .. {tag}: found {len(rows)} rows, using even bands")
        rows = [(round(i * solid.shape[0] / 5), round((i + 1) * solid.shape[0] / 5)) for i in range(5)]
    sheet = Image.new("RGBA", (CELL * 6, CELL * 6))
    counts = []
    for ri, ((name, n), (y0, y1)) in enumerate(zip(TARGETS, rows)):
        band = solid[y0:y1]
        segs = segments(band.sum(0), 10, 14, thr=max(3, (y1 - y0) // 25))
        if name != "idle" and not 3 <= len(segs) <= 8:  # fixed-count rows are evenly spaced: split evenly instead
            W = solid.shape[1]
            xs = np.flatnonzero(band.any(0))
            lo, hi = xs[0], xs[-1] + 1
            dens = np.convolve(band.sum(0), np.ones(5), "same")
            cw = (hi - lo) / n
            cuts = [lo] + [int(np.argmin(dens[int(lo + cw * j - cw * 0.3):int(lo + cw * j + cw * 0.3)]) + int(lo + cw * j - cw * 0.3)) for j in range(1, n)] + [hi]
            segs = [(cuts[i], cuts[i + 1]) for i in range(n) if band[:, cuts[i]:cuts[i + 1]].sum() > 20]
        counts.append(len(segs))
        info = []
        for x0, x1 in segs:
            m = band[:, x0:x1]
            ys = np.flatnonzero(m.sum(1) >= 2)
            top, bot = ys[0], ys[-1] + 1
            low = m[max(top, bot - max(8, (bot - top) // 3)):bot]
            ax = x0 + np.median(np.nonzero(low)[1])
            info.append((x0, x1, y0 + bot, ax))
        rb = float(np.median([i[2] for i in info]))
        placed = []
        for x0, x1, by, ax in info:
            cy0, cy1 = y0, y1
            crop = scaled(rgba[cy0:cy1, x0:x1], SCALE)
            tile = Image.new("RGBA", (CELL + 2 * PAD, CELL + 2 * PAD))
            tile.paste(crop, (round(PAD + CELL / 2 + (x0 - ax) * SCALE), round(PAD + BASE + (cy0 - rb) * SCALE)))
            placed.append(tile.crop((PAD, PAD, PAD + CELL, PAD + CELL)))
        placed = pick(placed, n, pingpong=(name == "idle"))
        for ci, t in enumerate(placed):
            sheet.paste(t, (ci * CELL, ri * CELL))
        if name == "cast":
            for ci, t in enumerate(placed[1:3]):  # windup = the raise/charge frames of the cast
                sheet.paste(t, (ci * CELL, 5 * CELL))
    print(f"  {tag}: frames per row {counts}")
    sheet.quantize(256, method=Image.FASTOCTREE, dither=Image.NONE).save(dst, optimize=True)


def effects(src, dst, cols, rows, tag):
    rgba = cut_background(src)
    h, w = rgba.shape[:2]
    cw, ch = w / cols, h / rows
    s = FXCELL / max(cw, ch)
    sheet = Image.new("RGBA", (FXCELL * cols, FXCELL * rows))
    for r in range(rows):
        for c in range(cols):
            cell = rgba[round(r * ch):round((r + 1) * ch), round(c * cw):round((c + 1) * cw)]
            t = scaled(cell, s)
            sheet.paste(t, (c * FXCELL + (FXCELL - t.width) // 2, r * FXCELL + (FXCELL - t.height) // 2))
    sheet.quantize(256, method=Image.FASTOCTREE, dither=Image.NONE).save(dst, optimize=True)
    print(f"  {tag}: {cols}x{rows} effects")


if __name__ == "__main__":
    root, out = sys.argv[1:3]
    sheets = {  # class -> rarity order common, uncommon, rare, legendary (source files differ per class)
        "tank": ("m1", ["(6)", "(4)", "(5)", "(3)"]),
        "healer": ("n5", ["", "(1)", "(2)", "(3)"]),
        "dps": ("m2", ["", "(2)", "11", "(3)"]),
    }
    for cls, (folder, suffixes) in sheets.items():
        for rar, suf in zip(("common", "uncommon", "rare", "legendary"), suffixes):
            if cls == "dps" and suf in ("", "11"):
                name = "GPT Image 2 1.png" if suf == "" else "GPT Image 2 11.png"
            else:
                name = "GPT Image 2 1.png" if suf == "" else f"GPT Image 2 1 {suf}.png"
            character(f"{root}/{folder}/Spritesheet/{name}", f"{out}/{cls}_{rar}.png", f"{cls}_{rar}")
    for name, f in (("support", "(3)"), ("hit", "(2)"), ("status", ""), ("shot", "(7)")):
        fn = "GPT Image 2 1.png" if f == "" else f"GPT Image 2 1 {f}.png"
        effects(f"{root}/m3/Moves/{fn}", f"{out}/fx_{name}.png", 4, 4, name)
