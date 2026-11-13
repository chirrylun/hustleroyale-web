"""Draws the top-down guild hall (public/guild/hall.png) and writes the prop layout the game reads
(src/components/guild/layout.json). One layout drives both the art and the walking/tap logic.
Run: python tools/build_guild.py"""
import json, random
from PIL import Image, ImageDraw

W, H, S = 240, 135, 4  # base pixels, upscale
C = dict(ink="#1a1c2c", plum="#5d275d", red="#b13e53", orange="#ef7d57", gold="#ffcd75", lime="#a7f070", leaf="#38b764",
         teal="#257179", night="#29366f", blue="#3b5dc9", sky="#41a6f6", ice="#73eff7", paper="#f4f4f4", steel="#94b0c2",
         mist="#566c86", panel="#333c57", w1="#6b4430", w2="#7d5238", w3="#8f6444", w4="#4f3223", stone="#4a4f6a", stone2="#5a6080")

# id, label, link (href) or action, x, y, w, h  (percent of the hall)
PROPS = [
    dict(id="adventure", label="Adventure", action="adventure", x=4, y=6, w=13, h=30),
    dict(id="jobs", label="Job Board", action="jobs", x=21, y=9, w=15, h=26),
    dict(id="leaderboard", label="Hall of Champions", href="/leaderboard", x=41, y=8, w=17, h=24),
    dict(id="arena", label="Arena Gate", href="/arena", x=62, y=6, w=16, h=30),
    dict(id="hearth", label="", x=82, y=8, w=13, h=24),
    dict(id="training", label="Training Yard", href="/training", x=4, y=56, w=20, h=34),
    dict(id="barracks", label="Barracks", href="/team", x=38, y=64, w=24, h=28),
    dict(id="market", label="Marketplace", href="/market", x=74, y=58, w=20, h=32),
]
RUG = dict(x=29, y=40, w=42, h=22)

img = Image.new("RGB", (W, H), C["w1"])
d = ImageDraw.Draw(img)
rnd = random.Random(7)

def px(v, n):  # percent -> base pixels
    return int(v / 100 * n)

def box(x0, y0, x1, y1, c, o=None):
    d.rectangle([x0, y0, x1, y1], fill=C[c], outline=C[o] if o else None)

# Floor planks
for y in range(0, H, 9):
    for x in range(-(rnd.randint(0, 20)), W, 28):
        tone = rnd.choice(["w1", "w2", "w3", "w2"])
        box(x, y, x + 27, y + 8, tone, "w4")
        if rnd.random() < 0.4:
            d.point((x + rnd.randint(3, 24), y + rnd.randint(2, 6)), fill=C["w4"])

# Back wall
box(0, 0, W, 22, "stone")
for y in range(0, 22, 7):
    for x in range(-(y // 7 % 2) * 8, W, 16):
        box(x, y, x + 15, y + 6, "stone2" if (x // 16 + y // 7) % 2 else "stone", "panel")
box(0, 22, W, 25, "ink")
# Wall torches + banners
for tx in (50, 118, 190):
    box(tx, 4, tx + 3, 11, "w4")
    box(tx - 1, 1, tx + 4, 4, "orange"); box(tx, 0, tx + 3, 2, "gold")
for bx in (36, 150, 212):
    box(bx, 3, bx + 8, 17, "red", "ink"); box(bx + 3, 7, bx + 5, 12, "gold")

# Rug
rx, ry, rw, rh = px(RUG["x"], W), px(RUG["y"], H), px(RUG["w"], W), px(RUG["h"], H)
box(rx, ry, rx + rw, ry + rh, "plum", "ink")
box(rx + 3, ry + 3, rx + rw - 3, ry + rh - 3, "red", "gold")
box(rx + 9, ry + 8, rx + rw - 9, ry + rh - 8, "plum")
for i in range(5):
    cx = rx + rw // 2 + (i - 2) * 9
    box(cx - 1, ry + rh // 2 - 1, cx + 1, ry + rh // 2 + 1, "gold")

def rectp(p):
    return px(p["x"], W), px(p["y"], H), px(p["x"] + p["w"], W), px(p["y"] + p["h"], H)

def shadow(x0, y0, x1, y1):
    d.rectangle([x0 + 1, y1 - 1, x1 + 2, y1 + 2], fill="#2a1c14")

for p in PROPS:
    x0, y0, x1, y1 = rectp(p)
    w, h = x1 - x0, y1 - y0
    shadow(x0, y0, x1, y1)
    k = p["id"]
    if k == "adventure":  # dark portal in a stone frame
        box(x0, y0, x1, y1, "stone2", "ink")
        box(x0 + 3, y0 + 4, x1 - 3, y1, "ink")
        box(x0 + 5, y0 + 6, x1 - 5, y1 - 1, "night")
        for i in range(6):
            yy = y0 + 8 + i * 5
            box(x0 + 7, yy, x1 - 7, yy + 1, "blue" if i % 2 else "sky")
        box(x0 + w // 2 - 2, y0 + h // 2 - 6, x0 + w // 2 + 2, y0 + h // 2 + 6, "ice")
    elif k == "jobs":  # wooden board with pinned notes
        box(x0 + 3, y1 - 8, x0 + 6, y1, "w4"); box(x1 - 6, y1 - 8, x1 - 3, y1, "w4")
        box(x0, y0, x1, y1 - 6, "w3", "w4")
        box(x0 + 2, y0 + 2, x1 - 2, y1 - 8, "w2")
        for i, (nx, ny, nc) in enumerate([(4, 4, "paper"), (14, 6, "gold"), (24, 4, "paper"), (7, 17, "ice"), (18, 18, "paper"), (28, 16, "orange")]):
            if x0 + nx + 7 < x1 - 2:
                box(x0 + nx, y0 + ny, x0 + nx + 7, y0 + ny + 9, nc, "ink"); box(x0 + nx + 3, y0 + ny, x0 + nx + 4, y0 + ny + 1, "red")
    elif k == "leaderboard":  # trophy shelf
        box(x0, y0 + 6, x1, y1, "w3", "w4"); box(x0 + 2, y0 + 8, x1 - 2, y1 - 2, "w4")
        for tx, c in ((x0 + 6, "gold"), (x0 + w // 2 - 3, "gold"), (x1 - 12, "steel")):
            box(tx, y0 + 12, tx + 6, y0 + 15, c, "ink"); box(tx + 2, y0 + 15, tx + 4, y0 + 20, c); box(tx, y0 + 20, tx + 6, y0 + 22, "w2", "ink")
        box(x0 + 4, y0, x1 - 4, y0 + 5, "red", "ink")
    elif k == "arena":  # stone gate with bars and crossed swords
        box(x0, y0, x1, y1, "stone2", "ink")
        box(x0 + 4, y0 + 8, x1 - 4, y1, "ink")
        for bx in range(x0 + 6, x1 - 5, 4):
            box(bx, y0 + 9, bx + 1, y1, "mist")
        box(x0 + 4, y0 + 8, x1 - 4, y0 + 10, "steel")
        d.line([(x0 + w // 2 - 6, y0 + 1), (x0 + w // 2 + 6, y0 + 7)], fill=C["steel"], width=2)
        d.line([(x0 + w // 2 + 6, y0 + 1), (x0 + w // 2 - 6, y0 + 7)], fill=C["steel"], width=2)
    elif k == "hearth":
        box(x0, y0, x1, y1, "stone2", "ink"); box(x0 + 4, y0 + 8, x1 - 4, y1, "ink")
        box(x0 + 8, y1 - 8, x1 - 8, y1 - 1, "orange"); box(x0 + 11, y1 - 12, x1 - 11, y1 - 4, "gold"); box(x0 + 13, y1 - 16, x1 - 13, y1 - 8, "orange")
        box(x0 - 1, y0 + 4, x1 + 1, y0 + 8, "w4")
    elif k == "training":  # straw dummies + weapon rack
        for i in range(2):
            cx = x0 + 10 + i * 18
            box(cx - 1, y0 + 6, cx + 1, y1 - 2, "w4"); box(cx - 7, y0 + 12, cx + 7, y0 + 15, "w4")
            box(cx - 4, y0 + 2, cx + 4, y0 + 9, "gold", "ink"); box(cx - 5, y0 + 15, cx + 5, y0 + 27, "gold", "ink")
            box(cx - 2, y0 + 5, cx - 1, y0 + 6, "ink"); box(cx + 1, y0 + 5, cx + 2, y0 + 6, "ink")
        box(x0 + 2, y1 - 8, x1 - 2, y1, "w3", "w4")
        for i in range(5):
            d.line([(x0 + 4 + i * 6, y1 - 7), (x0 + 7 + i * 6, y1 - 15)], fill=C["steel"], width=1)
    elif k == "barracks":  # two bunks and a table
        for i in range(2):
            bx = x0 + 2 + i * (w // 2)
            box(bx, y0, bx + w // 2 - 4, y1 - 6, "w3", "w4")
            box(bx + 2, y0 + 3, bx + w // 2 - 6, y0 + 10, "paper", "ink"); box(bx + 2, y0 + 10, bx + w // 2 - 6, y1 - 9, "blue", "ink")
        box(x0 + w // 2 - 6, y1 - 7, x0 + w // 2 + 6, y1, "w2", "w4")
    elif k == "market":  # striped awning stall
        box(x0, y0 + 10, x1, y1, "w3", "w4")
        for i in range(0, w, 6):
            box(x0 + i, y0, min(x1, x0 + i + 5), y0 + 12, "red" if (i // 6) % 2 else "paper", "ink")
        for cx, c in ((x0 + 4, "lime"), (x0 + 14, "orange"), (x0 + 24, "gold"), (x0 + 33, "leaf")):
            if cx + 7 < x1:
                box(cx, y0 + 18, cx + 7, y0 + 25, c, "ink")
        box(x0 + 3, y1 - 9, x0 + 12, y1, "w2", "w4"); box(x1 - 12, y1 - 9, x1 - 3, y1, "w2", "w4")

img.resize((W * S, H * S), Image.NEAREST).save("public/guild/hall.png")

layout = dict(aspect=[16, 9], floor=dict(x0=6, x1=94, y0=42, y1=94), props=PROPS, rug=RUG)
json.dump(layout, open("src/components/guild/layout.json", "w"), indent=1)
print("ok")
