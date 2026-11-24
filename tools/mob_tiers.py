"""Makes the uncommon and rare sheets of a mob from its common sheet by recolouring (until tier art is drawn).
Each tier: hue shift in degrees, saturation multiplier, saturation added to grey pixels, value multiplier.
   python3 tools/mob_tiers.py            (skips a tier whose sheet already exists unless --force)"""
import colorsys, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent / "public/sprites"
TIERS = {
    "boar": {"uncommon": (-30, 1.7, 0.0, 0.85), "rare": (0, 0.7, 0.0, 0.5)},        # darker hide, near black
    "weaver": {"uncommon": (-85, 1.2, 0.1, 1.0), "rare": (0, 0.25, 0.0, 1.45)},     # teal, then bone white
    "wisp": {"uncommon": (-12, 1.0, 0.0, 1.05), "rare": (48, 1.15, 0.0, 0.8)},      # cyan, then deep violet-blue
    "beetle": {"uncommon": (0, 1.0, 0.0, 1.0), "rare": (0, 1.0, 0.0, 0.5)},         # (uncommon is tinted green below)
}


def tint(a: np.ndarray, hue: float, sat_mul: float, sat_add: float, val_mul: float, grey_to: float | None = None) -> np.ndarray:
    rgb = a[..., :3].astype(np.float32) / 255
    mx, mn = rgb.max(-1), rgb.min(-1)
    v = mx
    s = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
    # hue by hand (vectorised)
    d = np.maximum(mx - mn, 1e-6)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    h = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    grey = s < 0.18
    if grey_to is not None:  # give stone a colour: grey pixels take this hue
        h = np.where(grey, grey_to, h)
    h = (h + hue / 360) % 1
    s = np.clip(np.where(grey, s + sat_add, s * sat_mul), 0, 1)
    v = np.clip(v * val_mul, 0, 1)
    i = np.floor(h * 6).astype(int) % 6
    f = h * 6 - np.floor(h * 6)
    p, q, t = v * (1 - s), v * (1 - f * s), v * (1 - (1 - f) * s)
    out = np.stack([np.choose(i, [v, q, p, p, t, v]), np.choose(i, [t, v, v, q, p, p]), np.choose(i, [p, p, t, v, v, q])], -1)
    res = a.copy()
    res[..., :3] = (out * 255).round().astype(np.uint8)
    return res


force = "--force" in sys.argv
for mob, tiers in TIERS.items():
    src = ROOT / f"mob_{mob}_common.png"
    if not src.exists():
        continue
    a = np.asarray(Image.open(src).convert("RGBA"))
    for tier, (dh, sm, sa, vm) in tiers.items():
        dst = ROOT / f"mob_{mob}_{tier}.png"
        if dst.exists() and not force:
            continue
        grey_to = (0.33 if tier == "uncommon" else None) if mob == "beetle" else None  # mossy green stone
        if mob == "beetle" and tier == "uncommon":
            sa = 0.35
        Image.fromarray(tint(a, dh, sm, sa, vm, grey_to)).save(dst)
        print("made", dst.name)
