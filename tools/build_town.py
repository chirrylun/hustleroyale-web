"""Builds the big lobby and marketplace maps (public/town/<id>.webp) and src/lib/town/maps.json.

  python3 tools/build_town.py tools/town-src (the painted lobby.png and market.png it cuts up)

The painted pictures are one small plaza each. Here they are cut into pieces (walls and houses along the top,
hedges and fences down the sides, the low wall along the bottom, cobbles and dirt for the ground) and stretched
into a much larger yard, then the props and people are placed on it. Positions are in picture pixels.
"""
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1])
rng = random.Random(7)
UNIT = 60  # picture px per tile


def crop(im, x0, y0, x1, y1):
    return im.crop((x0, y0, x1, y1))


def quilt(canvas, rect, windows, src, tile=256, over=56):
    """Fill rect of canvas with random flipped patches taken from the given source windows, blended at the seams."""
    x0, y0, x1, y1 = rect
    step = tile - over
    for y in range(y0, y1, step):
        for x in range(x0, x1, step):
            wx0, wy0, wx1, wy1 = rng.choice(windows)
            px = rng.randint(wx0, max(wx0, wx1 - tile)); py = rng.randint(wy0, max(wy0, wy1 - tile))
            p = src.crop((px, py, px + tile, py + tile))
            if rng.random() < 0.5: p = ImageOps.mirror(p)
            if rng.random() < 0.5: p = ImageOps.flip(p)
            a = np.ones((tile, tile), np.float32)
            ramp = np.linspace(0, 1, over, dtype=np.float32)
            if x > x0: a[:, :over] *= ramp[None, :]
            if y > y0: a[:over, :] *= ramp[:, None]
            mask = Image.fromarray((a * 255).astype(np.uint8))
            canvas.paste(p, (x, y), mask)


def tile_h(canvas, piece, x0, x1, y):
    x, i = x0, 0
    while x < x1:
        q = ImageOps.mirror(piece) if i % 2 else piece
        canvas.paste(q, (x, y)); x += piece.width; i += 1


def tile_v(canvas, piece, x, y0, y1):
    y, i = y0, 0
    while y < y1:
        q = ImageOps.flip(piece) if i % 2 else piece
        canvas.paste(q, (x, y)); y += piece.height; i += 1


def lane(canvas, box, lift=1.1):
    """A paved lane: slightly lighter stone fading softly into the yard, so the routes read as roads."""
    from PIL import ImageFilter
    x0, y0, x1, y1 = box
    part = ImageEnhance.Brightness(canvas.crop(box)).enhance(lift)
    m = Image.new("L", part.size, 0)
    m.paste(255, (24, 24, part.width - 24, part.height - 24))
    canvas.paste(part, (x0, y0), m.filter(ImageFilter.GaussianBlur(14)))


def lobby(W, H):
    s = Image.open(SRC / "lobby.png").convert("RGB")
    c = Image.new("RGB", (W, H))
    quilt(c, (0, 0, W, H), [(875, 300, 1135, 860), (120, 460, 400, 1000)], s)
    # Avenues: north-south through the gate, east-west across the yard.
    lane(c, (W // 2 - 110, 300, W // 2 + 110, H - 190))
    lane(c, (130, 930, W - 130, 1090))
    emb = s.crop((410, 410, 845, 775))
    mask = Image.new("L", emb.size, 0)
    from PIL import ImageDraw
    ImageDraw.Draw(mask).ellipse((6, 6, emb.width - 6, emb.height - 6), fill=255)
    c.paste(emb, (W // 2 - emb.width // 2, 1010 - emb.height // 2), mask)
    tile_h(c, crop(s, 105, 0, 1150, 258), 105, W - 105, 0)
    c.paste(crop(s, 0, 0, 105, 258), (0, 0)); c.paste(crop(s, 1150, 0, 1254, 258), (W - 104, 0))
    tile_v(c, crop(s, 0, 258, 105, 1000), 0, 258, H - 254)
    tile_v(c, crop(s, 1150, 258, 1254, 1000), W - 104, 258, H - 254)
    tile_h(c, crop(s, 220, 1000, 1030, 1254), 220, W - 224, H - 254)
    c.paste(crop(s, 0, 1000, 220, 1254), (0, H - 254)); c.paste(crop(s, 1030, 1000, 1254, 1254), (W - 224, H - 254))
    return c


def market(W, H):
    s = Image.open(SRC / "market.png").convert("RGB")
    c = Image.new("RGB", (W, H))
    quilt(c, (0, 0, W, H), [(140, 300, 1100, 500), (140, 760, 1100, 1000)], s)
    road = crop(s, 110, 545, 1150, 715)
    tile_h(c, road, 100, W - 100, 830)
    tile_h(c, crop(s, 150, 0, 1150, 285), 150, W - 100, 0)
    c.paste(crop(s, 0, 0, 150, 560), (0, 0)); c.paste(crop(s, 1150, 0, 1254, 520), (W - 104, 0))
    tile_v(c, crop(s, 0, 700, 110, 980), 0, 560, H - 280)
    tile_v(c, crop(s, 1150, 640, 1254, 1000), W - 104, 520, H - 280)
    tile_h(c, crop(s, 250, 1130, 960, 1254), 250, W - 294, H - 124)
    c.paste(crop(s, 0, 980, 250, 1254), (0, H - 274)); c.paste(crop(s, 960, 980, 1254, 1254), (W - 294, H - 274))
    return c


# ---- what stands where (atlas indices: see public/town/props.json) ----
def P(i, x, y, label=None, href=None):
    d = {"i": i, "x": x, "y": y}
    if href: d["href"] = href
    if label: d["label"] = label
    return d


def N(npc, facing, x, y, action):
    return {"npc": npc, "facing": facing, "x": x, "y": y, "action": action}


LW, LH = 2880, 1980
LOBBY = {
    "title": "Main Lobby", "ground": "/town/lobby.webp", "w": LW, "h": LH, "online": True,
    "floor": [130, 300, LW - 130, LH - 190],
    "blocks": [[0, 0, LW, 300], [0, LH - 200, LW, LH]],
    "spawn": [LW // 2, 700],
    "props": [
        # North gate back to the guild: banners and lamps frame the avenue.
        P(35, LW // 2, 470, "Guild hall", "/home"), P(9, LW // 2 - 220, 440), P(10, LW // 2 + 220, 440),
        P(11, LW // 2 - 360, 450), P(11, LW // 2 + 360, 450),
        P(8, 800, 520), P(6, 2160, 450), P(14, 330, 470), P(15, LW - 330, 470),
        # Plaza round the emblem: lamps at the corners, benches along the avenue.
        P(11, LW // 2 - 330, 800), P(11, LW // 2 + 330, 800), P(11, LW // 2 - 330, 1240), P(11, LW // 2 + 330, 1240),
        P(12, LW // 2 - 190, 1320), P(12, LW // 2 + 190, 1320), P(13, LW // 2 - 360, 1020), P(13, LW // 2 + 360, 1020),
        # West: the arena yard (roped off, hay, banners, a statue to the winners, the sword sign over the entrance).
        P(17, 330, 700), P(17, 480, 700), P(17, 630, 700), P(17, 780, 700), P(17, 330, 1520), P(17, 480, 1520), P(17, 630, 1520), P(17, 780, 1520),
        P(18, 310, 840), P(18, 770, 1400), P(9, 260, 1010), P(24, 420, 1250), P(31, 980, 880), P(10, 960, 1220),
        # East: the class changer (hooded statue, stone table, flowers) and the storage yard (crates, barrels, cart).
        P(25, 2500, 850), P(26, 2330, 1210), P(13, 2540, 1090), P(23, 2120, 860), P(10, 2620, 760),
        P(20, 2470, 1560), P(21, 2610, 1560), P(22, 2220, 1650), P(19, 2560, 1700), P(32, 2150, 1400),
        # South: the road to the marketplace.
        P(16, LW // 2, 1760, "Marketplace", "/market"), P(11, LW // 2 - 300, 1700), P(11, LW // 2 + 300, 1700),
        P(14, 300, 1700), P(15, 560, 1690), P(14, LW - 300, 1330), P(33, 1020, 1660), P(33, 1860, 1660),
    ],
    "npcs": [
        N("gladiator", "right", 560, 1010, "arena"),
        N("class_changer", "left", 2330, 960, "classes"),
        N("storage_keeper", "left", 2320, 1500, "storage"),
        N("guard", "front", LW // 2 + 150, 560, "guard"),
    ],
}

MW, MH = 2640, 1860
MARKET = {
    "title": "Marketplace", "ground": "/town/market.webp", "w": MW, "h": MH, "online": False,
    "floor": [130, 330, MW - 130, MH - 160],
    "blocks": [[0, 0, 190, 600], [MW - 140, 0, MW, 560], [0, MH - 300, 270, MH], [MW - 310, MH - 300, MW, MH]],
    "spawn": [MW // 2, 960],
    "props": [],
    "npcs": [],
}
# Two stalls (potions, armour), then the storage keeper with his crates, centred on the street.
MARKET["props"] += [P(1, 840, 620), P(2, 1230, 620)]
MARKET["npcs"] += [N("merchant", "front", 965, 650, "merchant"), N("guard", "front", 1355, 650, "armourer")]
MARKET["npcs"].append(N("storage_keeper", "front", 1700, 650, "storage"))
MARKET["props"] += [P(20, 1550, 640), P(22, 1500, 700), P(21, 1870, 640), P(20, 2040, 650), P(22, 1960, 705)]
MARKET["props"] += [
    P(11, 650, 790), P(11, 1040, 790), P(11, 1440, 790), P(11, 1990, 790),
    P(9, 215, 420), P(10, MW - 215, 420), P(6, 420, 800 + 0), P(14, 470, 600), P(14, MW - 330, 600),
    # South of the street: the fountain square with benches, the well and the tavern corner.
    P(7, MW // 2, 1440), P(12, MW // 2 - 300, 1470), P(12, MW // 2 + 300, 1470), P(13, MW // 2 - 160, 1250), P(13, MW // 2 + 160, 1250),
    P(8, 2200, 1400), P(21, 2380, 1530), P(19, 2150, 1650), P(30, 560, 1280), P(27, 520, 1500), P(29, 760, 1550),
    P(14, 330, 1330), P(15, MW - 330, 1250), P(33, 1100, 1700), P(33, 1540, 1700), P(23, 1000, 1350),
    # The ends of the street.
    P(16, 215, 940, "Lobby", "/lobby"), P(16, MW - 215, 940, "Guild hall", "/home"),
]
MARKET["npcs"].append(N("guard", "left", MW - 330, 1030, "guard"))


def main():
    out = ROOT / "public" / "town"
    for name, fn, spec in (("lobby", lobby, LOBBY), ("market", market, MARKET)):
        fn(spec["w"], spec["h"]).save(out / f"{name}.webp", quality=92, method=6)
        print(name, spec["w"], spec["h"])
    path = ROOT / "src" / "lib" / "town" / "maps.json"
    d = json.loads(path.read_text())
    d["maps"] = {"market": MARKET, "lobby": LOBBY}
    path.write_text(json.dumps(d, indent=1))


if __name__ == "__main__":
    main()
