"""Checks equipment overlays against a body sheet.

  python3 tools/gear_preview.py <base sheet> <overlay> [<overlay> ...] [-o out.png]

Both are 1248 x 1248 sheets (6 x 6 cells of 208 px) on a magenta background. The overlays are stacked on the base in the order
given (boots first, weapon last) and written as one contact sheet with the magenta removed and a grid, scaled 2x, so every
frame of idle / walk / attack / cast / hurt / windup can be checked for sliding or size changes.
"""
import sys
from PIL import Image, ImageDraw
import numpy as np

CELL, COLS, ROWS = 208, 6, 6


def keyed(path):
    im = Image.open(path).convert("RGBA")
    if im.size != (CELL * COLS, CELL * ROWS):
        sys.exit(f"{path}: expected {CELL * COLS}x{CELL * ROWS}, got {im.size}")
    a = np.asarray(im).copy()
    m = (a[..., 0] > 235) & (a[..., 1] < 40) & (a[..., 2] > 235)
    a[m, 3] = 0
    return Image.fromarray(a)


def main():
    args = sys.argv[1:]
    out = "gear_preview.png"
    if "-o" in args:
        i = args.index("-o"); out = args[i + 1]; del args[i:i + 2]
    if len(args) < 2:
        sys.exit(__doc__)
    sheet = Image.new("RGBA", keyed(args[0]).size, (36, 40, 52, 255))
    sheet.alpha_composite(keyed(args[0]))
    for p in args[1:]:
        sheet.alpha_composite(keyed(p))
    sheet = sheet.resize((sheet.width * 2, sheet.height * 2), Image.NEAREST)
    d = ImageDraw.Draw(sheet)
    for i in range(1, COLS):
        d.line([(i * CELL * 2, 0), (i * CELL * 2, sheet.height)], fill=(90, 96, 120, 255))
    for j in range(1, ROWS):
        d.line([(0, j * CELL * 2), (sheet.width, j * CELL * 2)], fill=(90, 96, 120, 255))
    sheet.convert("RGB").save(out)
    print("wrote", out)


if __name__ == "__main__":
    main()
