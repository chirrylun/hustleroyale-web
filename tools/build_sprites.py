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
TARGET_H = 122  # idle body height in the cell, so every class stands the same size
FXCELL = 96
TARGETS = [("idle", 4), ("walk", 6), ("attack", 5), ("cast", 5), ("hurt", 2)]


def to_magenta(path):
    """RGB array on a flat magenta background, whatever the source used: real alpha, magenta, or a baked-in checkerboard."""
    im = Image.open(path)
    if im.mode == "RGBA" and np.asarray(im)[..., 3].min() < 250:
        bg = Image.new("RGBA", im.size, (255, 0, 255, 255))
        bg.alpha_composite(im)
        return np.asarray(bg.convert("RGB")).copy()
    a = np.asarray(im.convert("RGB")).copy()
    c = a[0, 0].astype(int)
    if c[0] > 200 and c[1] > 200 and c[2] > 200:  # light grey/white checkerboard: key out what touches the border
        v = a.astype(int)
        m = ((v.max(2) - v.min(2)) <= 8) & (v.min(2) >= 205)
        lab, n = ndi.label(m)
        edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
        a[np.isin(lab, edge[edge > 0])] = (255, 0, 255)
    return a


def cut_background(path, strict=False):
    """RGBA with the magenta removed: soft alpha plus colour un-mixing on edge pixels."""
    a = to_magenta(path).astype(np.float32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    m = np.minimum(r, b)
    mag = m - g
    bgish = (np.abs(r - b) < 70) & (m > 120)
    alpha = np.where(bgish, 1 - np.clip((mag - (25 if strict else 70)) / (55 if strict else 90), 0, 1), 1.0)
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


def character(src, dst, tag, fit=False, strict=False, six=False):
    """six=True: the source already has its own windup row (6 rows) instead of deriving it from the cast."""
    NR = 6 if six else 5
    targets = TARGETS + [("windup", 2)] if six else TARGETS
    rgba = cut_background(src, strict)
    solid = rgba[..., 3] > (200 if strict else 128)
    lab, k = ndi.label(solid)
    if k:
        keep = np.flatnonzero(ndi.sum(solid, lab, range(1, k + 1)) >= 60) + 1
        solid = np.isin(lab, keep)
    rows = segments(solid.sum(1), 6 if strict else 10, 20, thr=14)
    if len(rows) != NR:  # glow/sparkles glued rows together: the sheets are laid out in even fifths
        print(f"  .. {tag}: found {len(rows)} rows, using even bands")
        H = solid.shape[0]
        if six:  # cut at the emptiest line near each expected row boundary
            dens = np.convolve(solid.sum(1), np.ones(9), "same")
            cuts = [0] + [int(np.argmin(dens[int(H * j / NR - H * 0.06):int(H * j / NR + H * 0.06)]) + int(H * j / NR - H * 0.06)) for j in range(1, NR)] + [H]
            rows = list(zip(cuts[:-1], cuts[1:]))
        else:
            rows = [(round(i * H / NR), round((i + 1) * H / NR)) for i in range(NR)]
    SCALE = globals()["SCALE"]
    if fit:  # size by the idle row so tall hats, staffs and glows do not change how big a fighter stands
        b0 = solid[rows[0][0]:rows[0][1]]
        hs = []
        for x0, x1 in segments(b0.sum(0), 10, 14, thr=3)[:4]:
            ys = np.flatnonzero(b0[:, x0:x1].sum(1) >= 2)
            hs.append(ys[-1] - ys[0] + 1)
        SCALE = TARGET_H / float(np.median(hs))
        print(f"  {tag}: scale {SCALE:.3f}")
    sheet = Image.new("RGBA", (CELL * 6, CELL * 6))
    counts = []
    for ri, ((name, n), (y0, y1)) in enumerate(zip(targets, rows)):
        band = solid[y0:y1]
        segs = segments(band.sum(0), 10, 14, thr=max(3, (y1 - y0) // 25))
        if (six and (not 3 <= len(segs) <= 6 if name == "idle" else len(segs) != n)) or (name != "idle" and not 3 <= len(segs) <= 8):  # fixed-count rows are evenly spaced: split evenly instead
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
        if name == "cast" and not six:
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
    # Original class sheets: python tools/build_sprites.py <src> <out> classes   (kept for reference)
    # New packs:             python tools/build_sprites.py <new-root> <out> new
    root, out, mode = sys.argv[1], sys.argv[2], (sys.argv[3] if len(sys.argv) > 3 else "new")
    R = ("common", "uncommon", "rare", "legendary")
    if mode == "new":
        packs = {  # archetype -> {rarity: source file}
            "bard": ("Bard/Bard", dict(zip(R, ["(2)", "(4)", "(5)", "(3)"]))),
            "marksman": ("Marksman/Marksman", dict(zip(R, ["(4)", "(5)", "(2)", "(6)"]))),
            "rogue": ("Rogue/Rogue", dict(zip(R, ["(2)", "(3)", "rare", "("]))),
            "necromancer": ("Necromancer/Necromancer", {r: r for r in R}),
            "paladin": ("Paladin/Paladin", {r: r for r in R}),
        }
        for arch, (folder, m) in packs.items():
            for rar, key in m.items():
                name = f"{key}.png" if key in R or key == "rare" else f"GPT Image 2 1 {key}.png" if key != "(" else "GPT Image 2 1 (.png"
                character(f"{root}/{folder}/{name}", f"{out}/{arch}_{rar}.png", f"{arch}_{rar}", fit=True, strict=(arch in ("marksman", "paladin") and rar == "legendary"))
        for name, f in (("shot2", "(2.png"), ("support2", "(3.png"), ("ground", "(4).png")):
            effects(f"{root}/Moves_2/Moves/GPT Image 2 1 {f}", f"{out}/fx_{name}.png", 4, 4, name)
    if mode == "mage":  # Mage/Mage: common, uncommon, "(5)" = rare, "e" = legendary
        src = {"common": "common.png", "uncommon": "uncommon.png", "rare": "GPT Image 2 1 (5).png", "legendary": "GPT Image 2 e.png"}
        for rar, f in src.items():
            character(f"{root}/Mage/{f}", f"{out}/magical_dps_{rar}.png", f"magical_dps_{rar}", fit=True)

    if mode == "novice":  # Novice/: two gendered novices + the three recruit classes
        N = "GPT Image 2 1"
        for dst, src in (("novice_female", f"{N} (3)"), ("novice_male", f"{N} (4)"), ("recruit_acolyte", "acolyte"), ("recruit_fighter", "fighter"), ("recruit_thief", "dps")):
            character(f"{root}/Novice/Novice/{src}.png", f"{out}/{dst}.png", dst, fit=True, six=True)

    if mode == "mobs":  # <mob>/<mob>/ folders -> mob_<name>_<rarity>.png (file names are whatever the art tool called them)
        G = "GPT Image 2 1"
        F = {
            "slime": [f"{G} (4)", f"{G} (5)", f"{G} (6)", f"{G} (3)"],
            "bat": [f"{G} (3)", f"{G} (4)", f"{G} (5)", "legendary"],
            "direwolf": ["common", "GPT Image 2.5 Flare 1", "rare", "legendary"],
            "goblin": [f"{G} (3)", "uncommon", f"{G} (4)", "legendary"],
            "golem": ["common", "uncommon", "rare", "legendary"],
            "mushroom": ["common", "uncommon", "rare", "legendary"],
        }
        for mob, files in F.items():
            for rar, f in zip(["common", "uncommon", "rare", "legendary"], files):
                character(f"{root}/{mob}/{mob}/{f}.png", f"{out}/mob_{mob}_{rar}.png", f"{mob}_{rar}", fit=True, six=True)
