# Bow prompts (weapon type `bow`, ranks 1-4)

Same rules as `equipment-sprite-prompts-v2.md`: absolute pixel sizes, no motion effects, magenta #FF00FF background, 1248 x 1248 sheet, 6 x 6 grid of 208 px cells
(rows: idle 4, walk 6, attack 5, cast 5, hurt 2, windup 2), characters face right, feet y = 187, head top y = 66, body centre x = 104.
Ranks are **Rank 1 to Rank 4** (the look changes every rank). Classes that use it: Ranger (first tier), Marksman, Sharpshooter, and later Archer.

## Bow geometry (use these numbers)

| Part | Size in px | Notes |
|---|---|---|
| Bow, unstrung length | **104 tall** (limbs curve toward the target), 7 px thick at the grip | a bit shorter than the 122 px body, so it never leaves the cell |
| Grip | 12 px, sits **on the off-hand (front hand) fist** in every frame | the bow hand is the one nearest the target |
| String | 1 px, straight between the limb tips, 2 px of slack at rest | in attack frames it is pulled back to the chest, **the bow itself keeps its length** |
| Arrow (nocked, attack/windup rows only) | 56 long, 2 px shaft, 6 px head, small fletching | **never flying**, only held on the string; no arrow in idle, walk, hurt |
| Quiver | 22 x 38, on the back, strap across the chest | part of the Rank 1-4 look, same in every frame |

Idle and walk: bow held low in the front hand pointing forward-down at 20 degrees, string slack, no arrow. Windup (2 frames): arrow nocked, string half drawn. Attack (5 frames): full draw on frame 2-3, release on 4 (string snaps straight, **no arrow drawn after release, no motion lines**), recover on 5. Cast row: bow raised overhead in the front hand, fist closed (used for buffs). Hurt: bow lowered, body recoils.

## 1. Shared bow prompt (paste first, every time)

Attach: the bare sheet (male or female). For ranks 2-4 also attach the approved Rank 1 sheet as a size lock.

> 2D pixel-art **equipment overlay sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the fighter's bare sprite sheet (1248 x 1248, 6 x 6 cells of 208 px). Output the **identical canvas, grid, cell positions and frame counts**. In every frame the fighter faces right, feet on y = 187, head top y = 66, body centre x = 104.
>
> Draw **only the bow, string, arrow and quiver** described below, as solid objects held exactly where the bare sheet's body holds them: the **grip sits on the front-hand fist in every frame**, the quiver on the back, the string pulled to the chest in attack frames. Everything that is not the item (body, skin, clothes, shadow, ground) is **flat magenta #FF00FF**.
>
> **Exact size, never change it between frames:** the bow is **104 px tall**, the arrow **56 px**, the quiver **22 x 38 px**. Keep every pixel inside its own cell with 3 px margin. **No motion trails, no flying arrows, no glow, no sparkles, no shadows, no text.** Crisp 1 px dark outline, 3-4 shades per material, no anti-aliasing.

## 2. Per rank

**Rank 1** (plain hunter's bow, light wood, hemp string, brown leather quiver with three plain grey-feathered arrows):
> Rank 1 "plain" **short hunting bow**: single curved limb of pale ash wood, wrapped leather grip, hemp string. Arrow: wooden shaft, iron head, grey feathers. Quiver: brown leather with a plain strap. No decoration at all.

**Rank 2** (reinforced, steel tips and dark wood):
> Rank 2 "reinforced" **recurve bow**: darker oak with small steel caps on both limb tips, a brown leather grip with one metal band. Arrow: steel head, white feathers. Quiver: darker leather with a steel buckle and a green-trimmed strap.

**Rank 3** (composite bow, engraved):
> Rank 3 "knight-grade" **composite recurve**: layered wood and horn with a steel riser, thin engraved gold line along the limbs, blue grip wrap. Arrow: polished steel head, blue feathers. Quiver: dark leather with steel plates and a blue trim.

**Rank 4** (runed, glowing detail kept as flat colour):
> Rank 4 "runed" **longbow of runes**: pale silver-white limbs with carved glowing-cyan rune marks (flat colour pixels only, no glow effect), gold limb caps, a white feathered string-nock. Arrow: silver shaft, cyan head, white feathers. Quiver: black leather with gold rivets and a cyan rune on the flap.

## 3. Stand-alone icon prompts (fastest to get something in the game now)

The shop, bag and equipment screens only need an **icon**, so these work even before the overlay sheets are right. One bow per image, 1024 x 1024, flat magenta background, three-quarter view, bow upright, **no hand, no character**, centred with 15% margin:

> Pixel-art item icon, 16-bit JRPG, a single **[rank prompt line from section 2]**, upright, string visible, **no arrow, no hand, no character, no text, no glow**, crisp 1 px dark outline, flat magenta #FF00FF background.

Save as `public/gear/icons/bow_<1-4>.png` after `python3 tools/build_gear_art.py`, or send me the four images and I will wire them.

## 4. Why overlays are the risky part

The weapon sheets we got before were not aligned to the body sheets, so they could not be laid over the animation. For bows, if the first overlay misses the fist by more than a few pixels, stop and use the icons plus the planned **hand-socket** approach instead: I add a per-frame grip point to the body sheets and draw the bow from the icon at that point, rotating with the arm. That needs no re-generation per class.
