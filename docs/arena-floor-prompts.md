# Arena fight hall: floor art

The battle hall is now **72 x 36 arena units (2:1)** and the camera shows a window of it, so the picture is drawn big and crisp instead of stretched from the old 240x120 `public/arena/dungeon.png`.

Style reference: attach `public/arena/dungeon.png` (current look), `public/town/arena.webp` (the town arena) and `public/town/props.png`.

## Facts the art must respect
- Canvas **2880 x 1440 px** (2:1). Save as `public/arena/hall.png`; I will swap it in.
- **Top 13% (about 187 px) is the back wall**; the fighting floor is the rest. Fighters stand anywhere on the floor, so the floor must be **open, flat and readable**: no pillars, furniture or deep shadows that hide sprites.
- Top-down three-quarter view like the town maps (floor seen from slightly above, wall faces the camera).
- Keep it **low contrast and slightly desaturated** in the middle so health bars, damage numbers and skill effects pop. Put the interest (torches, banners, crowd, scorch marks) at the **edges and the back wall**.
- Both sides are mirrored left to right: **perfectly symmetric**.
- Light from the top, soft; no cast shadows from objects that are not drawn.

## Shared look (paste first)
> 2D pixel-art in the style of the attached images: Chained Echoes / 16-bit JRPG, warm slightly desaturated palette, dark plum outlines, chunky readable tiles, crisp pixels with no anti-aliasing or blur. An **empty gladiator hall seen from above at a three-quarter angle**, canvas **2880 x 1440 px**. **Top 187 px: the back wall** (stone with torches and hanging banners). Below it: a **huge open floor** of large stone flagstones with a worn, sandy fighting circle in the centre (a very large oval, subtle, not a hard line), a faint centre line marking the two sides, and **raised spectator ledges with a few cheering silhouettes** only along the far left and far right edges and the back wall. Completely **symmetric left to right**. The middle floor stays plain and low contrast so characters and effects stay readable. No characters, no props in the middle, no text.

## A. Default hall (challenge)
> [shared look] Dark blue-grey flagstones, sand-coloured fighting circle, iron torches on the back wall, red and navy banners.

## B. Raid hall (floor raid)
> [shared look] Mossy dungeon stone with cracks and a few puddles at the edges, green-lit torches on the back wall, rusted chains hanging from the wall, ground a little darker so mob sprites stand out.

## C. Boss hall (boss rush)
> [shared look] Black volcanic stone with thin glowing ember cracks near the edges only, a faint carved rune ring in the centre floor (very low contrast), tall braziers with orange flame on the back wall, skull-and-horn banners.

## Optional: wall strip only
If the full hall comes out too busy, ask for **only the back wall, 2880 x 187 px, seamless left to right**, and a separate **floor tile 192 x 192 px, seamless on all four edges**; I will tile the floor to fill the hall.

## How I will use it
`ArenaBackdrop` draws one image over the whole hall (inside the camera). Per mode, name them `public/arena/hall.png`, `hall-raid.png` and `hall-boss.png`.
