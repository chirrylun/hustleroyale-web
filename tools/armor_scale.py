"""Writes src/lib/armorScale.json: for every armour sheet, the factor that brings its idle body height to the novice's 122 px,
so a fighter's size doesn't jump when armour is put on. Re-run after adding armour sheets.   python3 tools/armor_scale.py"""
import glob, json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
out = {}
for f in sorted(glob.glob(str(ROOT / "public/sprites/armor_*.png"))):
    a = np.asarray(Image.open(f).convert("RGBA"))[:208, :, 3]
    hs = []
    for c in range(4):
        ys = np.where(a[:, c * 208:(c + 1) * 208] > 0)[0]
        if len(ys):
            hs.append(ys.max() - ys.min() + 1)
    if hs:
        out[Path(f).stem] = round(122 / float(np.median(hs)), 3)
(ROOT / "src/lib/armorScale.json").write_text(json.dumps(out, indent=1) + "\n")
print(len(out), "sheets")
