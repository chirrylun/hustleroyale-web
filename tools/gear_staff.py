"""Draws the Soldier Long Staff and seats it on a novice body sheet, frame by frame.

  python3 tools/gear_staff.py <body sheet> <out.png>

Rules (from the gear prompt): 150 px long, shaft 4 px (+ outline), head ornament 18 px, never resized between frames.
Idle / walk / hurt: vertical, planted at y=187 in front of the front fist (grip near y=118, head at y=37).
Cast: head up-right about 45 degrees, crystal brighter and steady on frames 2-4. Attack / windup: follows the sword arm
(tilt clamped so the staff stays inside its 208 px cell). Everything else is magenta.
"""
import sys
import numpy as np
from PIL import Image
sys.path.insert(0, __file__.rsplit("/", 1)[0])
from gear_anchor import CELL, N, USED, body_blade, front_fist, load  # noqa: E402

L, GRIP = 150, 69  # length; grip row counted from the head end (fist at y=118 when the head is at y=37)
OUT = (28, 26, 46)


def staff(bright=False):
    W = 26
    img = np.zeros((L, W, 4), np.uint8)
    cx = W // 2

    def put(x, y, c):
        if 0 <= y < L and 0 <= x < W:
            img[y, x] = (*c, 255)

    # Shaft: polished wood, light left, dark right
    wood = [(222, 170, 104), (196, 138, 78), (160, 104, 58), (118, 74, 42)]
    for y in range(30, L - 12):
        for i, c in enumerate(wood):
            put(cx - 2 + i, y, c)
        if y % 9 in (3, 4): put(cx - 1, y, wood[0])       # polish glints
        if y % 13 == 6: put(cx, y, wood[2])               # grain
    # Leather grip wrap with red cloth end
    for y in range(GRIP - 11, GRIP + 12):
        base = (190, 150, 96) if (y // 2) % 2 == 0 else (160, 120, 74)
        for x in range(cx - 2, cx + 2): put(x, y, base)
    for x in range(cx - 2, cx + 2): put(x, GRIP + 12, (176, 52, 52)); put(x, GRIP + 13, (128, 36, 40))
    for x in range(cx - 2, cx + 2): put(x, GRIP - 12, (176, 52, 52))
    # Steel foot cap
    steel = [(196, 206, 222), (150, 164, 188), (112, 126, 152)]
    for y in range(L - 12, L - 3):
        for i in range(4): put(cx - 2 + i, y, steel[0 if i == 0 else 1 if i < 3 else 2])
    for i, y in enumerate(range(L - 3, L)):
        for x in range(cx - 1 + (i > 1), cx + 2 - (i > 1)): put(x, y, steel[1])
    # Steel cap and cradle claws under the crystal
    for y in range(22, 31):
        half = 3 if y < 27 else 4
        for x in range(cx - half, cx + half):
            put(x, y, steel[0] if x < cx - 1 else steel[1] if x < cx + 1 else steel[2])
    for y in range(8, 24):  # claws curl up round the crystal
        t = (23 - y) / 15
        off = int(5 + 4 * np.sin(t * np.pi / 1.15))
        for s in (-1, 1):
            for w in range(2): put(cx + s * off - (w if s < 0 else -w) - (1 if s < 0 else 0) + (1 if s > 0 else 0), y, steel[0] if s < 0 else steel[2])
    # Blue crystal (faceted)
    pal = dict(hi=(214, 240, 255), light=(120, 188, 255), mid=(64, 128, 232), dark=(34, 76, 172))
    if bright:
        pal = dict(hi=(255, 255, 255), light=(170, 224, 255), mid=(96, 172, 255), dark=(54, 112, 214))
    rows = [(1, 2), (2, 4), (3, 6), (4, 7), (5, 8), (6, 8), (7, 8), (8, 8), (9, 8), (10, 8), (11, 7), (12, 6), (13, 5), (14, 3), (15, 2)]
    for y, h in rows:
        for x in range(cx - h + 1, cx + h + 1):
            f = "mid"
            if x < cx - h // 2: f = "light"
            if x >= cx + h // 2 + 1: f = "dark"
            put(x, y + 2, pal[f])
    for (x, y) in ((cx - 3, 6), (cx - 3, 7), (cx - 2, 5), (cx - 4, 8)): put(x, y, pal["hi"])
    put(cx + 1, 12, pal["light"])
    # 1 px dark outline round everything
    a = img[..., 3] > 0
    ring = np.zeros_like(a)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ring |= np.roll(np.roll(a, dy, 0), dx, 1)
    ring &= ~a
    ring[:, 0] = ring[:, -1] = False
    img[ring] = (*OUT, 255)
    return Image.fromarray(img)


def seat(canvas, art, grip_xy, tilt_deg, cell_origin):
    """Rotate `art` about its grip point (tilt clockwise, head up at 0) and paste with the grip at grip_xy in the cell."""
    gx, gy = art.width // 2, GRIP + 1
    R = L + 6
    pad = Image.new("RGBA", (2 * R, 2 * R), (0, 0, 0, 0))
    pad.paste(art, (R - gx, R - gy))
    pad = pad.rotate(-tilt_deg, resample=Image.NEAREST, center=(R, R))
    ox, oy = cell_origin
    left, top = int(round(ox + grip_xy[0] - R)), int(round(oy + grip_xy[1] - R))
    # keep the whole staff inside its cell with a 3 px margin
    bb = pad.getbbox()
    dx = dy = 0
    if bb:
        x0, y0, x1, y1 = left + bb[0] - ox, top + bb[1] - oy, left + bb[2] - ox, top + bb[3] - oy
        if x0 < 3: dx = 3 - x0
        if x1 > CELL - 3: dx = CELL - 3 - x1
        if y0 < 3: dy = 3 - y0
        if y1 > CELL - 3: dy = CELL - 3 - y1
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer.paste(pad, (left + dx, top + dy))
    canvas.alpha_composite(layer)


def main():
    base_p, out_p = sys.argv[1:3]
    base = load(base_p, key=False)
    res = Image.new("RGBA", (CELL * N, CELL * N), (0, 0, 0, 0))
    art, art_b = staff(False), staff(True)
    for r, count in USED.items():
        for c in range(count):
            cell = base[r * CELL:(r + 1) * CELL, c * CELL:(c + 1) * CELL]
            origin = (c * CELL, r * CELL)
            fist = front_fist(cell)
            if r in (0, 1, 4):  # idle, walk, hurt: planted, head at y=37
                seat(res, art, (fist[0] + 2, 37 + GRIP + 1), 0, origin)
            elif r == 3:        # cast: head up and forward at 45 degrees
                seat(res, art_b if c in (1, 2, 3) else art, (fist[0], fist[1]), 45, origin)
            else:               # attack / windup: follow the sword arm
                bb = body_blade(cell)
                if bb is None:
                    seat(res, art, (fist[0], fist[1]), 0, origin); continue
                hilt, d = bb
                grip = hilt - d * 6
                tilt = float(np.clip(np.degrees(np.arctan2(d[0], -d[1])), -55, 60))
                seat(res, art, grip, tilt, origin)
    out = Image.new("RGBA", res.size, (255, 0, 255, 255))
    out.alpha_composite(res)
    out.convert("RGB").save(out_p)
    print("wrote", out_p)


if __name__ == "__main__":
    main()
