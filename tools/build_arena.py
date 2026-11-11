"""Paints the 240x120 pixel-art dungeon floor used as the arena backdrop (python tools/build_arena.py <out.png>)."""
import random, sys, math
from PIL import Image, ImageDraw

W, H, WALL = 240, 120, 15
rnd = random.Random(7)
img = Image.new("RGB", (W, H), (35, 31, 53))
d = ImageDraw.Draw(img)
px = img.load()
FLOOR = [(58, 50, 82), (64, 55, 90), (52, 45, 75), (68, 59, 94)]
MORTAR, HI = (31, 27, 46), (86, 76, 118)

# floor: staggered stone slabs with per-slab tone, bevel and wear
for ty, y in enumerate(range(WALL, H, 9)):
    off = 6 if ty % 2 else 0
    for x in range(-12 + off, W, 12):
        c = rnd.choice(FLOOR)
        d.rectangle([x, y, x + 11, y + 8], fill=MORTAR)
        d.rectangle([x + 1, y + 1, x + 11, y + 8], fill=c)
        d.line([x + 1, y + 1, x + 10, y + 1], fill=tuple(min(255, v + 14) for v in c))
        d.line([x + 1, y + 8, x + 11, y + 8], fill=tuple(v - 10 for v in c))
        for _ in range(rnd.randint(0, 3)):
            sx, sy = rnd.randint(x + 2, x + 10), rnd.randint(y + 2, y + 7)
            if 0 <= sx < W and 0 <= sy < H:
                px[sx, sy] = tuple(v + rnd.choice((-8, 8)) for v in c)

# cracks and stains
for _ in range(26):
    x, y = rnd.randint(8, W - 8), rnd.randint(WALL + 4, H - 6)
    for _ in range(rnd.randint(5, 12)):
        px[x, y] = (33, 28, 50)
        x += rnd.choice((-1, 0, 1, 1)); y += rnd.choice((-1, 0, 1))
        x, y = max(0, min(W - 1, x)), max(WALL, min(H - 1, y))
for _ in range(9):
    cx, cy, r = rnd.randint(10, W - 10), rnd.randint(WALL + 6, H - 8), rnd.randint(3, 6)
    for yy in range(cy - r, cy + r):
        for xx in range(cx - r * 2, cx + r * 2):
            if 0 <= xx < W and WALL <= yy < H and ((xx - cx) / (r * 2)) ** 2 + ((yy - cy) / r) ** 2 < 1 and rnd.random() < 0.35:
                px[xx, yy] = tuple(int(v * 0.82) for v in px[xx, yy])

# dueling circle: dashed ring + inner ring around the centre
cx, cy = W // 2, WALL + (H - WALL) // 2
for a in range(0, 360, 3):
    for rx, ry, on in ((46, 26, a % 12 < 8), (30, 17, a % 9 < 6)):
        if on:
            x, y = int(cx + math.cos(math.radians(a)) * rx), int(cy + math.sin(math.radians(a)) * ry)
            if WALL < y < H - 2:
                px[x, y] = HI

# back wall: brick rows with shadowed base
d.rectangle([0, 0, W, WALL - 1], fill=(43, 37, 64))
for r, y in enumerate(range(0, WALL - 3, 5)):
    for x in range(-8 + (4 if r % 2 else 0), W, 8):
        d.rectangle([x, y, x + 6, y + 3], fill=rnd.choice(((53, 45, 77), (47, 40, 70), (58, 50, 84))))
        d.line([x, y, x + 6, y], fill=(72, 62, 100))
d.rectangle([0, WALL - 3, W, WALL - 1], fill=(26, 22, 40))
d.line([0, WALL - 4, W, WALL - 4], fill=(70, 60, 98))

# torches along the wall, with a soft light pool on the floor
for tx in (30, 90, 150, 210):
    d.rectangle([tx - 1, 5, tx + 1, 9], fill=(94, 60, 40))
    d.rectangle([tx - 1, 1, tx + 1, 4], fill=(255, 205, 117))
    d.rectangle([tx, 0, tx, 2], fill=(255, 240, 180))
    for yy in range(WALL, WALL + 22):
        for xx in range(tx - 20, tx + 21):
            k = 1 - math.hypot((xx - tx) / 20, (yy - WALL) / 22)
            if 0 <= xx < W and k > 0 and (xx + yy) % 2 == 0 and k > 0.25:
                px[xx, yy] = tuple(min(255, int(v + 26 * k)) for v in px[xx, yy])

# vignette: dithered darkening toward edges and bottom
for y in range(H):
    for x in range(W):
        e = max(abs(x - W / 2) / (W / 2), (y - H * 0.5) / (H * 0.5)) if y > WALL else 0
        if e > 0.82 and (x + y) % 2 == 0:
            px[x, y] = tuple(int(v * 0.8) for v in px[x, y])
        if e > 0.94:
            px[x, y] = tuple(int(v * 0.7) for v in px[x, y])
img.save(sys.argv[1] if len(sys.argv) > 1 else "public/arena/dungeon.png", optimize=True)
