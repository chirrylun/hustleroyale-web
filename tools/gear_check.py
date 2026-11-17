"""Measures an equipment overlay so size and placement drift is caught before it ships.

  python3 tools/gear_check.py <overlay.png> [--len N]   N = intended item length in px (dagger 44, sword 84, mace 72, staff 150 ...)

Prints, for every frame of the 6 x 6 sheet: the item's bounding box (x0 y0 x1 y1 inside the 208 px cell), its longest side, and the
pixel count. Flags: an item that changes length by more than 12% between frames (the pose may turn it, it should not grow), frames that
touch the cell edge, and near-white pixels (slash trails and impact flashes, which must not be in an overlay).
"""
import sys
from PIL import Image
import numpy as np

CELL = 208
ROWS = [("idle", 4), ("walk", 6), ("attack", 5), ("cast", 5), ("hurt", 2), ("windup", 2)]


def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if not a:
        sys.exit(__doc__)
    want = float(sys.argv[sys.argv.index("--len") + 1]) if "--len" in sys.argv else None
    if want is not None:
        a = [x for x in a if x != str(sys.argv[sys.argv.index("--len") + 1])]
    full = np.asarray(Image.open(a[0]).convert("RGBA")).astype(int)
    im = full[..., :3]
    if im.shape[:2] != (1248, 1248):
        sys.exit(f"expected 1248x1248, got {im.shape[1]}x{im.shape[0]}")
    bg = ((im[..., 0] > 235) & (im[..., 1] < 40) & (im[..., 2] > 235)) | (full[..., 3] < 10)
    white = (im.min(axis=2) > 232) & ~bg
    longest = []
    for r, (name, n) in enumerate(ROWS):
        for c in range(n):
            sl = (slice(r * CELL, (r + 1) * CELL), slice(c * CELL, (c + 1) * CELL))
            m = ~bg[sl]
            ys, xs = np.where(m)
            if not len(ys):
                print(f"{name:6}{c}: EMPTY"); continue
            x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
            L = float(np.hypot(x1 - x0 + 1, y1 - y0 + 1))
            longest.append(L)
            flags = []
            if x0 <= 1 or y0 <= 1 or x1 >= CELL - 2 or y1 >= CELL - 2: flags.append("TOUCHES EDGE")
            if white[sl].sum() > 12: flags.append(f"WHITE/FX {int(white[sl].sum())}px")
            print(f"{name:6}{c}: box {x0:3} {y0:3} {x1:3} {y1:3}  diag {L:5.1f}  px {int(m.sum()):5}  {' '.join(flags)}")
    if longest:
        med = float(np.median(longest))
        print(f"median extent {med:.0f}px; frames off by >12%: {sum(abs(x - med) / med > .12 for x in longest)} of {len(longest)}")
        if want: print(f"target length {want:.0f}px -> median is {med / want * 100:.0f}% of target (a swung item can read up to ~1.15x)")


if __name__ == "__main__":
    main()
