# Equipment prompts v2 (weapons + full armour sets)

Supersedes part A of `equipment-sprite-prompts.md` (potions and alchemist there are unchanged). What changed and why, from the first samples:
weapons came out too big and off the hand, and slash-trail arcs were drawn into the attack/cast rows. v2 pins **absolute pixel sizes, anchors and angles**,
bans all motion effects, makes the **wand a long staff**, and replaces separate top/bottom pieces with **full armour sets as whole character sheets**.

## Measured geometry of the base body (use these numbers, not "a third of the body")

Cell = 208 x 208 px. In every frame: **feet on y = 187**, **head top at y = 66** (body 122 px tall, about 66 px wide), body centre **x = 104**.
Characters face **right**. In attack the arm and weapon reach to about x = 190-200; in cast about x = 186. Nothing may cross the cell edge.

| Item | Total length / size in px | Notes |
|---|---|---|
| Dagger | 44 long (blade 30, guard 5, grip 9), max 8 wide | about 36% of body |
| Sword | 84 long (blade 62, guard 14 wide, grip 10, pommel 4), blade 9 wide | about 70% of body |
| Mace | 70 long, head 22 x 22, haft 4 wide | |
| **Long staff** | **150 long**, shaft 4 px wide, head ornament 16-20 px | taller than the body (122) on purpose; foot of the shaft at y = 187 when planted |
| Shield (small) | 46 x 46 | on the off-hand forearm |
| Broadshield | 58 wide x 80 tall | tower shape, bottom edge at about y = 175 |

Weapon grip centre sits **on the fist of the main hand in the attached bare sheet, in every frame** (the weapon moves only because the fist moves).
The shield strap sits on the off-hand forearm. The item length must not change between frames; only its angle changes with the arm.

## Pipeline (do it in this order, the order is what keeps things matched)

1. **Bare bases** (Step 0 in the old doc): `public/sprites/bare/novice_male.png`, `novice_female.png` (empty fists, no weapon, no FX). Everything below is made against these.
2. **Weapons**: one weapon at a time. Make **Rookie first**, check it, then make Soldier, Knight, Runed **with the approved Rookie sheet attached as a size lock**.
3. **Armour sets**: made by restyling the same bare base, so the body pose cannot drift. Check each against the weapons with `gear_preview.py`.
4. Run `python3 tools/gear_check.py <sheet> --len <px>` on each weapon. It prints per-frame boxes and flags slash trails (white pixels), edge touching, and size drift. Pass = median within 90-110% of the target length, 0 frames off by more than 12%, no WHITE/FX.
5. `python3 tools/gear_preview.py <bare or armour sheet> <weapon> [shield] -o out.png` and look at all 6 rows.

Files: `public/gear/<male|female>/weapon_<type>_<1-4>.png` (type = dagger, sword, mace, staff, shield, broadshield) and `public/sprites/armor/<role>_<1-4>_<male|female>.png`. Ranks: 1 Rookie, 2 Soldier, 3 Knight, 4 Runed.

---

## 1. Shared weapon prompt (paste first, every time)

Attach: the bare sheet (male or female). For ranks 2-4 also attach the approved rank 1 sheet of the same weapon, and say "second attachment is the approved size lock".

> 2D pixel-art **equipment overlay sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the fighter's bare sprite sheet: **1248 x 1248 px, 6 columns x 6 rows of 208 px cells**, rows = idle (4 frames), walk (6), attack (5), cast (5), hurt (2), windup (2). Output the **identical canvas, grid, cell positions and frame counts**. In every frame the fighter faces right, feet on y = 187 of the cell, head top y = 66, body centre x = 104.
>
> Draw **only the item named below**, as one solid object, held or worn exactly where the bare sheet's body holds it. The **grip centre of a held item sits on the main-hand fist of the bare sheet in every frame**; the item moves only because the fist moves. Everything that is not the item (body, skin, hair, clothes, shadow, ground) is **flat magenta #FF00FF**.
>
> **Exact size, never change it between frames:** use the pixel length given in the item prompt. The item must not be bigger, smaller, bent or restyled from frame to frame; only its angle follows the arm. Keep every pixel inside its own 208 px cell with at least 3 px of margin.
>
> **Absolutely no effects:** no slash trails, no motion arcs, no swoosh, no white or light streaks, no impact flashes, no glow halos, no sparks, no shadows, no speed lines, no ghost copies of the item. The attack and cast rows show the **item only**, as a solid object in its pose. (Runed rune lines are part of the item and stay inside its outline.)
>
> Style: crisp hard pixel edges, no anti-aliasing, no blur, no gradients, 1 px dark outline in a darker shade of the item's own colours (not pure black), soft top-left light, gentle cel shading, limited rich palette, fully opaque. Chunky 2.5-head JRPG proportions. Empty cells are flat magenta. No text, no numbers, no border.
>
> **Tier looks.** **Rookie:** dull brown leather, plain grey iron, undyed cloth, scuffed. **Soldier:** bright steel with blue-grey shading, tan leather, a little red cloth, clean. **Knight:** polished steel with gold trim, deep red leather and cloth, one small gem. **Runed:** dark blued steel with gold edging, glowing cyan rune lines 2-3 px wide (a gentle 2-frame shimmer in idle only), deep navy cloth; best looking, still grounded, never flashy.

### Pose per row (applies to every weapon, only the named item type changes)

- **Idle / walk:** held relaxed at the hip along the arm (blade or head pointing forward-down about 30 degrees below horizontal), staff planted vertical (see staff).
- **Attack (5):** follows the base arm exactly: windup back, swing through the front, follow-through, recover. Draw the item at its true length at each angle, nothing more.
- **Cast (5):** dagger and sword held up and forward as a focus; mace raised; staff head raised toward the target. Item only, no magic.
- **Hurt (2):** item recoils 2 px with the arm. **Windup (2):** item raised ready, same length.

## 2. Weapon item prompts (paste one after the shared prompt)

Each line is the whole item prompt: fill rank and design from the table.

> **[Rank] Dagger**: a short dagger, **44 px long in total** (blade 30, guard 5, grip 9), blade 7 px wide, in the main hand. [design]. Use the [Rank] tier look.

| Rank | Dagger design |
|---|---|
| Rookie | short grey iron blade, wrapped brown grip, no guard to speak of |
| Soldier | straight steel blade, tan grip wrap, small crossguard |
| Knight | gold-capped guard, red grip, tiny gem in the pommel |
| Runed | dark curved blade with a cyan rune line, gold edge |

> **[Rank] Sword**: a one-handed sword, **84 px long in total** (blade 62, crossguard 14 wide, grip 10, pommel 4), blade 9 px wide, in the main hand. [design]. Use the [Rank] tier look.

| Rank | Sword design |
|---|---|
| Rookie | plain iron blade, wooden grip |
| Soldier | steel blade with a blue-grey fuller, leather grip |
| Knight | polished blade, gold crossguard, red leather grip |
| Runed | dark steel blade, glowing cyan rune down the fuller, gold guard |

> **[Rank] Mace**: a one-handed mace, **70 px long in total**, haft 4 px wide, head about 22 x 22 px, in the main hand. [design]. Use the [Rank] tier look.

| Rank | Mace design |
|---|---|
| Rookie | round iron head on a wooden haft |
| Soldier | flanged steel head, leather strap |
| Knight | gold-banded flanged head, red grip |
| Runed | dark steel flanged head with cyan runes, gold bands |

> **[Rank] Long Staff** (replaces the wand): a **long staff, 150 px long in total**, shaft 4 px wide, head ornament 16 to 20 px, held in the main hand. **Idle, walk, hurt:** held vertical, foot of the shaft planted on the ground at y = 187 slightly in front of the feet, the fist gripping it at about y = 118, so the head reaches y = 37. **Attack:** the staff stays at full length and swings with the arm as a two-handed-looking sweep; **cast:** the staff is raised forward and tilted so the head points up-right at about 45 degrees, the head ornament glowing as a **steady brighter fill** (no halo outside its outline) over frames 2 to 4; **windup:** staff held diagonally across the body. [design]. Use the [Rank] tier look.

| Rank | Staff design |
|---|---|
| Rookie | knotted wooden branch, a dull green crystal chip bound at the top with twine |
| Soldier | straight polished wood, steel cap and foot, blue crystal in a steel cradle |
| Knight | gold-wrapped shaft, red crystal held in a gold claw, small red ribbon |
| Runed | dark wood with cyan rune bands, gold claws, bright cyan crystal |

> **[Rank] Shield**: a small shield, **46 x 46 px**, strapped to the off-hand forearm and drawn in front of the torso; kept up in attack, jolts back 2 px in hurt, stays the same size in all frames. [design]. Use the [Rank] tier look.

| Rank | Shield design |
|---|---|
| Rookie | round wooden board, iron rim and centre boss |
| Soldier | round steel, blue-grey face, tan strap |
| Knight | kite shape, red face, gold rim, small crest |
| Runed | dark steel kite, gold rim, ring of cyan runes |

> **[Rank] Broadshield**: a tower shield, **58 px wide x 80 px tall**, on the off-hand, held about 6 px out from the body, bottom edge at about y = 175, drawn in front of the torso; in windup the fighter crouches behind it, same size in all frames. [design]. Use the [Rank] tier look.

| Rank | Broadshield design |
|---|---|
| Rookie | planks bound with iron straps |
| Soldier | riveted rectangular steel |
| Knight | red field, gold trim and a crest |
| Runed | dark steel, gold border, large glowing cyan sigil |

---

## 3. Armour sets: full-body character sheets

Three role families to start (they cover the 12 classes; class-specific trims come later as recolours):
**Tank** (shield tank, fighter tank, debuff tank, paladin), **Healer** (pure healer, battle medic, warden, bard), **DPS** (rogue, mage, marksman, necromancer).
Each is 4 ranks x male and female = 24 sheets. These **replace** the body, so they are whole characters, not overlays.

Attach: `public/sprites/bare/novice_male.png` (or female) only. Not the weapon sheets.

> 2D pixel-art **character sprite sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the bare novice sprite sheet: **1248 x 1248 px, 6 x 6 grid of 208 px cells**, rows = idle (4), walk (6), attack (5), cast (5), hurt (2), windup (2). **Redraw exactly the same sheet, the same character, wearing a full armour set.** Keep **pixel-identical**: the canvas and grid, every pose, every frame, the **head size and position (head top y = 66)**, **feet baseline y = 187**, body centre x = 104, body height 122 px, the face, hair colour and skin tone, and the arm and leg motion of each frame. Only the clothing changes. The armour **hugs the body outline**: it may add at most 3 px of bulk to any limb and 5 px at the shoulders, and nothing (cape, tassel, plume, skirt) may hang more than 6 px outside the base silhouette.
>
> **Hands are empty, fists loosely closed exactly where the base sheet's hands are, in every frame. No weapon, no shield, no staff, no bag.** The attack, cast and windup rows keep the same arm motion as if holding something that is not drawn. **No effects of any kind**: no magic, no glow outside the armour, no slash trails, no sparks, no shadow, no ground. Background flat magenta #FF00FF. Crisp hard pixel edges, no anti-aliasing, 1 px dark outline in a darker shade of each material, soft top-left light, gentle cel shading, limited rich palette. Armour covers the whole body as **one coordinated set**: headgear (face and hair fringe stay visible), torso, shoulders, arms, gloves, legs and boots.
>
> **Rank looks.** **1 Rookie:** dull brown leather, undyed cloth, a bit scuffed, simple. **2 Soldier:** bright steel with blue-grey shading, tan straps, a little red cloth, clean and sturdy. **3 Knight:** polished steel with gold trim, deep red cloth, one small gem. **4 Runed:** dark blued steel or deep navy cloth with gold edging and glowing cyan rune lines 2-3 px wide (a gentle shimmer on idle only); the best of the four but still a grounded adventurer's kit, **not** a special-event costume.
>
> **Set:** [role set from the table]

| Role | 1 Rookie | 2 Soldier | 3 Knight | 4 Runed |
|---|---|---|---|---|
| **Tank** | padded brown gambeson, leather shoulder caps, plain iron skullcap, leather boots and gloves | steel breastplate with leather pauldrons, red sash, open steel helm with nose guard, steel greaves | polished plate with gold trim, red tabard, small gem on the chest, steel helm with a short red plume, gold-buckled greaves | dark blued plate with gold edging, glowing cyan chest rune and cyan lines on pauldrons, crested helm with a gold brow band, navy cape stub (6 px max) |
| **Healer** | undyed cream robe with a brown rope belt, leather sandals-boots, plain cloth hood **down on the shoulders** (head uncovered) | white and blue-grey robe with a short steel gorget, red sash, tan satchel strap, soft leather boots | white robe with gold trim, deep red stole, gold clasp with a gem, gold circlet, white-gold boots | deep navy robe with gold edging and glowing cyan glyph lines down the front and hem, gold circlet with a cyan stone, navy mantle stub (6 px max) |
| **DPS** | brown leather jerkin, cloth sleeves, leather bracers, a plain cloth headband, brown boots | tan studded leather jacket, steel bracers, red scarf, steel shoulder cap on one side, leather boots | dark leather with gold buckles and trim, deep red scarf, a small gem clasp, gold-edged bracers, leather cap with a short feather | near-black navy leather with gold edging and glowing cyan rune lines on chest and bracers, light cowl pushed back, navy scarf stub (6 px max) |

Save as `public/sprites/armor/<role>_<rank>_<male|female>.png`. Build with the normal sprite build (it normalises scale), then verify scale with
`python3 tools/gear_preview.py public/sprites/armor/<set>.png public/gear/<g>/weapon_sword_<n>.png -o out.png`: the blade must sit in the fist in every one of the 24 frames.

## 4. Review checklist (answer yes to all before moving on)

- `gear_check.py` shows no WHITE/FX frames and the median length is within 90-110% of the item's pixel length.
- Rank 1 vs rank 4 of the same weapon: same length, same grip position, only the design differs (flip between them in the preview).
- Weapon grip is inside the fist in idle, walk, attack, cast, hurt, windup (6 spot checks, not just idle).
- Armour sheet head top is at y = 66 and feet at y = 187 in every frame (the check prints these as `box y0 / y1`).
- Staff head stays inside the cell in idle (top y about 37) and in cast.
- Male and female sheets of the same set share rank colours.

## 5. If a result keeps failing

Do not argue with the model for ten rounds. Two fixes work: (1) attach the approved rank 1 sheet and write "match its item size, angle and position in every frame exactly, change only the design"; (2) generate a single row (for example only the attack row, 5 frames in a 1040 x 208 strip), check it, and paste the good rows into the full sheet.
