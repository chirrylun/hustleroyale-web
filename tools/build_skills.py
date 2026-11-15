"""Builds the skill art from the hand-drawn sheets in Moves22.zip.

  python3 tools/build_skills.py <folder with the unzipped PNGs> [<icon sheet 2 png>]

Writes
  public/sprites/fx_<name>.png   4x4 effect sheets (a row per effect, four frames), transparent, 192 px cells
  public/skills/<name>.png       one 128 px icon per skill

The sheets arrive on a flat magenta background. The background is removed by flood-filling inwards from the
edges (so pink or purple art inside an effect survives), then the fringe left by anti-aliasing is trimmed.
Each effect row is scaled as one piece and centred on its cell, so the four frames stay put relative to each
other and the animation does not jitter when it plays.
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
FX_CELL = 192
ICON = 128

# Sheet file -> effect sheet name (see FxSheet in src/lib/sprites/designs.ts).
FX_SHEETS = {
    "GPT Image 2 1 (3).png": "slash",
    "GPT Image 2 1 (4).png": "arrow",
    "GPT Image 2 1 (5).png": "bolt",
    "GPT Image 2 1 (6).png": "impact",
    "GPT Image 2 1 (7).png": "dark",
    "GPT Image 2 1 (8).png": "heal",
    "GPT Image 2 1 (9).png": "guard",
    "GPT Image 2 1 (10).png": "music",
    "GPT Image 2 1 (11).png": "move",
    "skill (1).png": "extra",
}

ICON_SHEETS = {
    "skill (2).png": [
        "stab", "slash", "quick-stab", "crossed-swords",
        "backstab", "dash", "vanish", "shadow-step",
        "aimed-shot", "pin-shot", "volley", "poison-arrow",
        "power-slam", "shield-bash", "danfo-hook", "holy-strike",
        "taunt", "weaken", "rally-cry", "shield-wall",
        "aegis", "fortress", "locked", "empty",
    ],
    "icons2": [
        "basic-bolt", "dark-bolt", "arc-lightning", "hush",
        "soul-drain", "curse", "raise-skeleton", "first-aid",
        "heal-pulse", "basic-heal", "renewal", "purify",
        "lay-on-hands", "group-blessing", "divine-light", "sonic-note",
        "dirge", "war-song", "quickstep-tune", "boost",
        "haste", "skill-book", "star",
    ],
}


def key_out(img: Image.Image) -> Image.Image:
    """Magenta background -> transparent."""
    a = np.asarray(img.convert("RGB")).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bg_like = (r > 170) & (b > 170) & (g < 110) & (np.minimum(r, b) - g > 90)
    lab, n = ndimage.label(bg_like)
    edge = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge)) if edge else np.zeros_like(bg_like)
    # Pockets of background enclosed by art (the hole in a ring) are background too, unless they are tiny specks.
    sizes = ndimage.sum(bg_like, lab, index=range(1, n + 1))
    for k in np.flatnonzero(sizes > 150) + 1:
        bg |= lab == k
    # Trim the pink halo around the art: edge pixels that still lean magenta.
    for _ in range(3):
        near = ndimage.binary_dilation(bg, iterations=1) & ~bg
        tint = (np.minimum(r, b) - g > 45) & (r > 90) & (b > 90)
        bg |= near & tint
    # Soften the cut by one pixel so the edge is not jagged against the page.
    soft = ndimage.binary_erosion(~bg, iterations=1)
    alpha = np.where(bg, 0, np.where(soft, 255, 170)).astype(np.uint8)
    rgba = np.dstack([a.clip(0, 255).astype(np.uint8), alpha])
    return Image.fromarray(rgba, "RGBA")


def bounds(img: Image.Image):
    box = img.getchannel("A").point(lambda v: 255 if v > 24 else 0).getbbox()
    return box


def resize(img: Image.Image, size) -> Image.Image:
    return img.convert("RGBa").resize(size, Image.LANCZOS).convert("RGBA")


def edges(n: int, total: int):
    return [round(i * total / n) for i in range(n + 1)]


def build_fx(path: Path, name: str, out: Path):
    sheet = key_out(Image.open(path))
    w, h = sheet.size
    xs, ys = edges(4, w), edges(4, h)
    out_img = Image.new("RGBA", (FX_CELL * 4, FX_CELL * 4), (0, 0, 0, 0))
    for r in range(4):
        cells = [sheet.crop((xs[c], ys[r], xs[c + 1], ys[r + 1])) for c in range(4)]
        boxes = [bounds(c) for c in cells]
        boxes = [b for b in boxes if b]
        if not boxes:
            continue
        x0, y0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
        x1, y1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
        scale = FX_CELL * 0.94 / max(x1 - x0, y1 - y0)
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        for c, cell in enumerate(cells):
            cw, ch = cell.size
            big = resize(cell, (max(1, round(cw * scale)), max(1, round(ch * scale))))
            ox = round(FX_CELL / 2 - cx * scale)
            oy = round(FX_CELL / 2 - cy * scale)
            tile = Image.new("RGBA", (FX_CELL, FX_CELL), (0, 0, 0, 0))
            tile.alpha_composite(big, (ox, oy)) if ox >= 0 and oy >= 0 else tile.paste(big, (ox, oy))
            out_img.alpha_composite(tile, (c * FX_CELL, r * FX_CELL))
    out_img.save(out / f"fx_{name}.png", optimize=True)


def icon_cells(path: Path, names, cols=4, rows=6):
    """One icon per slot. The sheet's rows are not evenly spaced, so icons are found as blobs of art and read
    in order (row by row, left to right); bits too small to be an icon are joined to the nearest icon or dropped."""
    sheet = key_out(Image.open(path))
    alpha = np.asarray(sheet.getchannel("A")) > 24
    arr = np.asarray(sheet)
    # Widen the blobs until each icon is one piece (an icon with a detached spark would otherwise count twice).
    for grow in (4, 6, 8, 11, 14, 18):
        lab, n = ndimage.label(ndimage.binary_dilation(alpha, iterations=grow))
        area = ndimage.sum(alpha, lab, index=range(1, n + 1))
        big = [k for k in range(1, n + 1) if area[k - 1] > 2500]
        # A piece sitting inside another one's box (the plus inside the empty-slot frame) belongs to it.
        ob = ndimage.find_objects(lab)
        inside = lambda a, c: ob[a - 1][0].start >= ob[c - 1][0].start and ob[a - 1][0].stop <= ob[c - 1][0].stop and ob[a - 1][1].start >= ob[c - 1][1].start and ob[a - 1][1].stop <= ob[c - 1][1].stop
        contained = {a: c for a in big for c in big if a != c and inside(a, c)}
        big = [k for k in big if k not in contained]
        if len(big) == len(names):
            break
    else:
        raise SystemExit(f"{path.name}: found {len(big)} icons, expected {len(names)}")
    objs = ndimage.find_objects(lab)
    mid = lambda k: ((objs[k - 1][0].start + objs[k - 1][0].stop) / 2, (objs[k - 1][1].start + objs[k - 1][1].stop) / 2)
    by_y = sorted(big, key=lambda k: mid(k)[0])
    # Split into rows at the largest vertical gaps, then order each row by x.
    gaps = sorted(range(1, len(by_y)), key=lambda i: mid(by_y[i])[0] - mid(by_y[i - 1])[0], reverse=True)[: rows - 1]
    cuts = [0, *sorted(gaps), len(by_y)]
    ordered = [k for a, b in zip(cuts, cuts[1:]) for k in sorted(by_y[a:b], key=lambda k: mid(k)[1])]
    # Small fragments (sparkles, drips) join the closest icon when they are near it.
    owner = {k: k for k in big}
    owner.update({a: c for a, c in contained.items() if c in owner})
    for k in range(1, n + 1):
        if k in owner:
            continue
        cy, cx = mid(k)
        near = min(big, key=lambda j: (mid(j)[0] - cy) ** 2 + (mid(j)[1] - cx) ** 2)
        sj = objs[near - 1]
        if sj[0].start - 30 <= cy <= sj[0].stop + 30 and sj[1].start - 30 <= cx <= sj[1].stop + 30:
            owner[k] = near
    for name, k in zip(names, ordered):
        ids = [j for j, o in owner.items() if o == k]
        y0 = min(objs[j - 1][0].start for j in ids); y1 = max(objs[j - 1][0].stop for j in ids)
        x0 = min(objs[j - 1][1].start for j in ids); x1 = max(objs[j - 1][1].stop for j in ids)
        part = arr[y0:y1, x0:x1].copy()
        keep = np.isin(lab[y0:y1, x0:x1], ids)
        part[..., 3] = np.where(keep, part[..., 3], 0)
        art = Image.fromarray(part, "RGBA")
        box = bounds(art)
        if box:
            yield name, art.crop(box)


def save_icon(name: str, art: Image.Image, out: Path):
    s = (ICON * 0.88) / max(art.size)
    art = resize(art, (max(1, round(art.width * s)), max(1, round(art.height * s))))
    tile = Image.new("RGBA", (ICON, ICON), (0, 0, 0, 0))
    tile.alpha_composite(art, ((ICON - art.width) // 2, (ICON - art.height) // 2))
    tile.save(out / f"{name}.png", optimize=True)


def main():
    src = Path(sys.argv[1])
    icons2 = Path(sys.argv[2]) if len(sys.argv) > 2 else None
    fx_out = ROOT / "public" / "sprites"
    icon_out = ROOT / "public" / "skills"
    icon_out.mkdir(parents=True, exist_ok=True)
    for f, name in FX_SHEETS.items():
        build_fx(src / f, name, fx_out)
        print("fx", name)
    for f, names in ICON_SHEETS.items():
        p = icons2 if f == "icons2" else src / f
        if p is None:
            continue
        for name, art in icon_cells(p, names):
            save_icon(name, art, icon_out)
        print("icons", f, len(names))
    # An icon with no drawing of its own borrows a frame of its effect.
    blast = key_out(Image.open(src / "GPT Image 2 1 (5).png"))
    w, h = blast.size
    xs, ys = edges(4, w), edges(4, h)
    cell = blast.crop((xs[2], ys[3], xs[3], ys[4]))
    box = bounds(cell)
    if box:
        save_icon("generator-blast", cell.crop(box), icon_out)


if __name__ == "__main__":
    main()
