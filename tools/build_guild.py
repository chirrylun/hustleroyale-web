"""Builds the guild hall from the guild tilesets in tools/tilesets/.

Outputs
  public/guild/hall.png        floor, rugs, walls and baked prop shadows (1600x896, 64 px per tile)
  public/guild/props/<id>.png  every prop as its own transparent sprite (so fighters can walk in front of / behind them)
  src/components/guild/layout.json  the prop placement, footprints (what blocks walking), hotspots and spots fighters visit

One layout drives the art, the walking (obstacles) and the tap logic. Everything is in tile units (1 tile = 64 px).
Run from the web repo root:  python tools/build_guild.py
"""
import json, os, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
T, COLS, ROWS = 64, 25, 14            # px per tile, hall size in tiles (25 x 14 = 1600 x 896)
W, H = COLS * T, ROWS * T
WALL_H = 3 * T                         # the back wall is three tiles tall
FRAME_TILES = 3.25                     # a fighter's sprite frame, in tiles (the character itself is ~1 x 1.9 tiles)

tiles_img = Image.open(os.path.join(HERE, "tilesets", "tiles_guild.png")).convert("RGB")
CELL = tiles_img.width / 8             # the tile sheet is an 8 x 8 grid of 156.75 px cells


def tile(c, r, w, h=None, inset=4):
    h = h or w
    t = tiles_img.crop((round(c * CELL) + inset, round(r * CELL) + inset, round((c + 1) * CELL) - inset, round((r + 1) * CELL) - inset))
    return t.resize((w, h), Image.LANCZOS)


rnd = random.Random(11)
hall = Image.new("RGB", (W, H), (110, 70, 40))

# ---- floor: wooden planks in 2x2-tile blocks, never the same neighbour twice
B = 2 * T
prev_row = [-1] * (W // B + 2)
for j, y in enumerate(range(WALL_H, H, B)):
    last = -1
    for i, x in enumerate(range(0, W, B)):
        choices = [c for c in range(8) if c != last and c != prev_row[i]]
        c = rnd.choice(choices)
        hall.paste(tile(c, 0, B), (x, y))
        last, prev_row[i] = c, c

# a few floor decals (stain, coins, scratches) on open wood
for (cx, cy, c) in ((1216, 448, 5), (1344, 704, 7), (704, 704, 6), (960, 192 + 128 * 4, 7)):
    hall.paste(tile(c, 3, B), (cx, cy))

# ---- stone training yard (bottom-left): ragged top edge, solid stone, ragged right edge
yard_top = WALL_H + 2 * B                               # y = 448 (wood above, ragged stone edge)
cols = 4                                                # 4 cells of 128 px wide
for i in range(cols):
    for j, y in enumerate(range(yard_top, H, B)):
        last_col, first_row = i == cols - 1, j == 0
        if first_row and last_col:
            t = tile(3, 3, B).transpose(Image.FLIP_TOP_BOTTOM)                                      # stone bottom-left, wood elsewhere
        elif first_row:
            t = tile(i % 8, 2, B).transpose(Image.FLIP_TOP_BOTTOM)
        elif last_col:
            t = tile(i % 8, 2, B).transpose(Image.ROTATE_90)                                         # stone on the left, wood on the right
        else:
            t = tile(rnd.choice([0, 1, 2, 3, 4, 5, 6, 7]), 1, B)
        hall.paste(t, (i * B, y))

# ---- red rug in the middle: framed squares in four patterns
RUG = dict(x=8.5, y=6.0, w=8, h=4)
for i in range(RUG["w"] // 2):
    for j in range(RUG["h"] // 2):
        hall.paste(tile(rnd.randrange(4), 4, B), (round(RUG["x"] * T) + i * B, round(RUG["y"] * T) + j * B))

# ---- back wall: eight 200 x 192 px segments (beams, banners, torches)
SEG = W // 8
for i in range(8):
    hall.paste(tile(i, 5, SEG, WALL_H), (i * SEG, 0))
shade = Image.new("L", (W, 26))
sd = ImageDraw.Draw(shade)
for yy in range(26):
    sd.line([(0, yy), (W, yy)], fill=int(120 * (1 - yy / 26) ** 2))
hall.paste((20, 12, 8), (0, WALL_H), shade)  # shadow the wall casts on the floor

# ---- props: cut each one out of the keyed sheet
props_img = Image.open(os.path.join(HERE, "tilesets", "props_guild.png")).convert("RGB")
pa = np.array(props_img).astype(int)
r_, g_, b_ = pa[..., 0], pa[..., 1], pa[..., 2]
bgmask = (r_ > 160) & (b_ > 160) & (g_ < 120)
fg = ndi.binary_fill_holes(ndi.binary_opening(~bgmask, iterations=1))
pink = (r_ > 140) & (b_ > 140) & (g_ < 150) & ((r_ + b_) / 2 - g_ > 70)
fg &= ~(pink & ndi.binary_dilation(bgmask, iterations=2))   # drop the magenta fringe
labels, _ = ndi.label(ndi.binary_dilation(fg, iterations=6))
rgba_full = np.dstack([pa, fg * 255]).astype(np.uint8)

# name -> a point inside the prop on the sheet (and an optional vertical split for two props that touch)
SRC = dict(
    board=(112, 120), portal=(322, 117), gate=(528, 113), trophy=(734, 124), fireplace=(948, 120, "top"), scarecrow=(1107, 123),
    target=(1197, 133), bunk=(110, 336), market=(320, 331), desk=(530, 343), rack=(736, 331), anvil=(930, 340, "bottom"),
    shelf=(1150, 328), roundtable=(110, 530), banquet=(330, 540), banner_red=(505, 530), banner_blue=(595, 530), torch=(737, 523),
    candelabra=(944, 530), barrels=(1150, 533), crates=(115, 724), chest=(331, 741), gold=(533, 737), plant=(735, 725),
    map=(941, 733), statue=(1156, 734), clock=(111, 930), door=(338, 930), window=(530, 935), stairs=(728, 933), dog=(946, 955),
    potion=(1154, 943),
)
SPLIT_Y = 255


def cut(name):
    x, y, *part = SRC[name]
    lab = labels[y, x]
    if lab == 0:  # click landed in a gap: take the nearest label
        win = labels[max(0, y - 30):y + 30, max(0, x - 30):x + 30]
        lab = np.bincount(win[win > 0]).argmax()
    m = labels == lab
    if part:
        yy = np.arange(labels.shape[0])[:, None]
        m &= (yy < SPLIT_Y) if part[0] == "top" else (yy >= SPLIT_Y)
    a = rgba_full.copy()
    a[..., 3] = np.where(m & fg, 255, 0)
    img = Image.fromarray(a, "RGBA")
    return img.crop(img.getbbox())


# id, sheet name, scale (hall px per sheet px), centre x tile, bottom y tile (where it touches the floor),
# footprint (fractions of the sprite box x0,y0,x1,y1 that block walking), extras
P = []


def prop(pid, src, cx, by, k=0.9, foot=(0.06, 0.58, 0.94, 0.98), group=None, href=None, action=None, solid=True, spot=None, emote=None, wall=False, work=None):
    P.append(dict(id=pid, src=src, cx=cx, by=by, k=k, foot=foot, group=group or pid, href=href, action=action, solid=solid, spot=spot, emote=emote, wall=wall, work=work))


# back wall, left to right
prop("portal", "portal", 3.0, 4.25, foot=(0.05, 0.62, 0.95, 0.98), group="adventure", action="adventure", spot=(3.0, 5.2), emote="🌀")
prop("banner_blue", "banner_blue", 5.25, 4.4, k=0.8, foot=(0.3, 0.88, 0.7, 1.0), spot=(5.25, 5.3))
prop("board", "board", 7.6, 4.3, foot=(0.05, 0.62, 0.95, 0.98), group="jobs", action="jobs", spot=(7.6, 5.3), emote="📜")
prop("window", "window", 10.2, 3.0, k=0.9, solid=False, wall=True)
prop("trophy", "trophy", 12.5, 4.45, foot=(0.04, 0.5, 0.96, 0.95), group="leaderboard", href="/leaderboard", spot=(12.5, 5.5), emote="🏆")
prop("banner_red", "banner_red", 14.7, 4.4, k=0.8, foot=(0.3, 0.88, 0.7, 1.0), spot=(14.7, 5.3))
prop("gate", "gate", 17.1, 4.25, foot=(0.04, 0.6, 0.96, 0.98), group="arena", href="/arena", spot=(17.1, 5.3), emote="⚔️")
prop("fireplace", "fireplace", 21.9, 4.7, k=0.92, foot=(0.08, 0.45, 0.92, 0.82), group="hearth", spot=(21.9, 5.9), emote="🔥")
prop("clock", "clock", 0.85, 5.6, k=0.8, foot=(0.15, 0.82, 0.85, 1.0))
# left: forge corner and the training yard on stone
prop("anvil", "anvil", 3.1, 8.1, k=0.85, foot=(0.05, 0.5, 0.95, 0.95), spot=(3.1, 8.9), emote="🔨")
prop("shelf", "shelf", 6.4, 7.5, k=0.9, foot=(0.04, 0.68, 0.96, 0.98), spot=(6.4, 8.3), emote="📖")
prop("scarecrow", "scarecrow", 1.7, 11.7, k=0.85, foot=(0.2, 0.8, 0.8, 1.0), group="training", href="/training", spot=(1.7, 12.7), work="attack")
prop("target", "target", 4.2, 11.7, k=0.85, foot=(0.2, 0.8, 0.8, 1.0), group="training", href="/training", spot=(4.2, 12.7), work="attack")
prop("rack", "rack", 6.9, 13.4, k=0.8, foot=(0.05, 0.55, 0.95, 0.98), group="training", href="/training", spot=(6.9, 11.6), emote="🗡️")
# middle: council table on the rug, barracks below
prop("roundtable", "roundtable", 12.5, 9.2, k=0.85, foot=(0.1, 0.3, 0.9, 0.9), spot=(12.5, 10.3), emote="🍺")
prop("bunk_a", "bunk", 10.6, 13.5, k=0.85, foot=(0.04, 0.5, 0.96, 0.98), group="barracks", href="/team", spot=(10.6, 11.7), emote="💤")
prop("bunk_b", "bunk", 14.0, 13.5, k=0.85, foot=(0.04, 0.5, 0.96, 0.98), group="barracks", href="/team", spot=(14.0, 11.7), emote="💤")
prop("candelabra", "candelabra", 9.1, 6.6, k=0.8, foot=(0.3, 0.8, 0.7, 1.0))
# right: dining, market and the guild's stores
prop("banquet", "banquet", 20.4, 9.6, k=0.85, foot=(0.04, 0.35, 0.96, 0.9), spot=(20.4, 10.7), emote="🍖")
prop("map", "map", 23.3, 7.6, k=0.8, foot=(0.1, 0.78, 0.9, 1.0), spot=(23.0, 8.4), emote="🗺️")
prop("market", "market", 20.9, 13.4, k=0.9, foot=(0.04, 0.55, 0.96, 0.98), group="market", href="/market", spot=(20.9, 11.4), emote="🛒")
prop("barrels", "barrels", 24.0, 13.7, k=0.8, foot=(0.06, 0.55, 0.94, 0.98))
prop("crates", "crates", 18.2, 13.6, k=0.8, foot=(0.06, 0.55, 0.94, 0.98))
prop("statue", "statue", 16.1, 13.1, k=0.7, foot=(0.1, 0.78, 0.9, 1.0))
prop("plant", "plant", 0.95, 8.0, k=0.7, foot=(0.2, 0.65, 0.8, 1.0))
prop("dog", "dog", 22.0, 6.7, k=0.7, solid=False)

os.makedirs(os.path.join(ROOT, "public", "guild", "props"), exist_ok=True)
out = []
shadow = Image.new("L", (W, H), 0)
sdraw = ImageDraw.Draw(shadow)
for p in P:
    sprite = cut(p["src"])
    w, h = round(sprite.width * p["k"]), round(sprite.height * p["k"])
    sprite = sprite.resize((w, h), Image.LANCZOS)
    sprite.save(os.path.join(ROOT, "public", "guild", "props", f"{p['id']}.png"), optimize=True)
    tw, th = w / T, h / T
    tx, ty = p["cx"] - tw / 2, p["by"] - th
    f0, g0, f1, g1 = p["foot"]
    foot = [round(tx + f0 * tw, 2), round(ty + g0 * th, 2), round(tx + f1 * tw, 2), round(ty + g1 * th, 2)]
    if p["solid"]:  # soft contact shadow under the footprint
        x0, y0, x1, y1 = (v * T for v in foot)
        sdraw.ellipse([x0 - 4, y1 - (y1 - y0) * 0.5, x1 + 6, y1 + 10], fill=110)
    ent = dict(id=p["id"], group=p["group"], x=round(tx, 3), y=round(ty, 3), w=round(tw, 3), h=round(th, 3), foot=foot if p["solid"] else None, wall=p["wall"])
    for k_ in ("href", "action", "spot", "emote", "work"):
        if p[k_]:
            ent[k_] = list(p[k_]) if k_ == "spot" else p[k_]
    out.append(ent)

shadow = shadow.filter(ImageFilter.GaussianBlur(5))
hall.paste((24, 14, 10), (0, 0), shadow.point(lambda v: int(v * 0.75)))
hall.save(os.path.join(ROOT, "public", "guild", "hall.png"), optimize=True)

layout = dict(
    cols=COLS, rows=ROWS, frame=FRAME_TILES,
    # where a fighter's feet may go (tiles); the rest is wall and furniture
    floor=dict(x0=0.8, x1=COLS - 0.8, y0=3.9, y1=ROWS - 0.35),
    props=out,
)
json.dump(layout, open(os.path.join(ROOT, "src", "components", "guild", "layout.json"), "w"), indent=1)
print("ok", len(out), "props")
