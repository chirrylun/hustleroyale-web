"""Finds sprite sheets whose walk or cast row is just the idle pose repeated (or barely moves), so the game can add a procedural step
bounce and borrow the attack row for casting until the art is redrawn.  Writes src/lib/spriteMotion.json (the cast list is informational: casting keeps its own row).   python3 tools/sprite_motion.py"""
import glob, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
N = [4, 6, 5, 5, 2, 2]  # idle, walk, attack, cast, hurt, windup


def cells(a, r):
    return [a[r * 208:(r + 1) * 208, c * 208:(c + 1) * 208] for c in range(N[r])]


def change(cs):
    return float(np.mean([(cs[i] ^ cs[i + 1]).sum() for i in range(len(cs) - 1)])) / (cs[0].sum() + 1)


stiff, cast = [], []
for f in sorted(glob.glob(str(ROOT / "public/sprites/*.png"))):
    name = Path(f).stem
    if name.startswith(("mob_", "gear_", "props", "npc")):
        continue
    im = Image.open(f).convert("RGBA")
    if im.size != (1248, 1248):
        continue
    a = np.asarray(im)[:, :, 3] > 0
    walk = cells(a, 1)
    legs = [np.ptp(np.where(c[140:])[1]) if c[140:].any() else 0 for c in walk]
    if change(walk) < 0.1 or (max(legs) - min(legs)) < 8:
        stiff.append(name)
    if change(cells(a, 3)) < 0.1:
        cast.append(name)
(ROOT / "src/lib/spriteMotion.json").write_text(json.dumps({"stiffWalk": stiff, "staticCast": cast}, indent=0) + "\n")
print(len(stiff), "stiff walks,", len(cast), "static casts")
