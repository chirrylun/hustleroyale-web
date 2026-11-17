# Equipment, potion and alchemist art prompts

Three parts: (A) equipment overlay sheets, (B) potion and stone icons, (C) the alchemist (plus her cauldron).
Look: 2D pixel art in the style of Chained Echoes / 16-bit JRPGs, the same as the fighter sheets.

---

## A. Equipment overlays

### How it works (read first)

Gear is drawn as **transparent overlay sheets that sit on top of a fighter's own sheet**, frame for frame. The game stacks them with the same animation, so a helmet is only correct if it is drawn in the *exact* pixel position of the head in *every* frame (idle, walk, attack, cast, hurt, windup).

- **Canvas:** 1248 x 1248 px, 6 columns x 6 rows, 208 px cells. Same layout as the fighter sheets: row 1 idle (4 frames), row 2 walk (6), row 3 attack (5), row 4 cast (5), row 5 hurt (2), row 6 windup (2). Unused cells stay empty.
- **One overlay sheet = one item** (one helmet, one sword...). Only that item is drawn, everything else is flat magenta (#FF00FF). Nothing of the body, no shadow, no ground.
- **Always generate against the body sheet.** Attach the fighter sheet the gear is for (for example `public/sprites/novice_male.png`) as the reference image and tell the generator to keep every item locked to that sheet's poses. Never generate gear without a reference; it will drift.
- **Layer order (bottom to top):** boots, bottom armour, top armour, helmet, then the weapon. A shield is drawn on the off-hand and **in front of** the torso. Because the game stacks layers, an item must never redraw skin, hair or other gear; it only covers its own area.
- **Check each sheet before keeping it:** `python3 tools/gear_preview.py <base sheet> <overlay sheet> [more overlays...]` writes a contact sheet of the composite so you can flip through every frame (see the script header). Reject any sheet where gear slides, jitters or changes size between frames.

### Start with the novices

Every other class sheet already has a class outfit and weapon painted into it, which would clash with new gear. So:

1. First do **`novice_male`** and **`novice_female`** (the class-less starting fighters).
2. For these two, generate a **bare base sheet** first (prompt A0). Gear overlays are drawn on the bare base, and the game shows the bare base when nothing is equipped in a slot.
3. Class sheets (paladin, mage, and so on) get the same treatment later, once the novice set looks right. The prompts below work for them unchanged; only the reference image changes.

### A0. Bare base (once per body sheet)

Run this once for **every body sheet that will wear gear**. Do the two novices first, then one class at a time.

> Attach the body sheet (for example `public/sprites/paladin_common.png`). Redraw **exactly the same sheet**: same 1248 x 1248 canvas, same 6 x 6 grid of 208 px cells, same poses, same frame positions, same body size and the **same feet baseline in every frame**. The fighter keeps their own **face, hair, skin tone, build and height** (copy them from the reference), but is **stripped to plain cloth underclothes**: a short-sleeved off-white undershirt and simple brown shorts to the knee, **bare feet, no hat or hood, no armour, no cape, no gloves, no belt or pouches, no jewellery, no weapon, no shield, no instrument or book**. Hands are **empty and slightly curled** wherever they held something, and the attack, cast and windup rows keep the same arm motion, as if swinging or casting with an empty hand. **Nothing that was in the original may remain** (no glowing orbs, no capes, no particle effects). Plain flat magenta (#FF00FF) background, crisp hard pixel edges, no anti-aliasing, 1px dark outline, no shadow, no ground, no text.

Per sheet, tell the generator what to keep (the face and hair are what players recognise):

| Sheet | Keep from the reference | Remove |
|---|---|---|
| `novice_male`, `novice_female` | face, hair, build | (already plain; just strip any hat, belt or weapon) |
| `paladin_common/uncommon/rare/legendary` | stern face, short hair, broad build | plate armour, helm, cape, tabard, sword, mace, shield |
| `magical_dps_*` (mage) | face, hair, slim build | robe, hat, cape, staff or wand, orb and glow |
| `healer_*`, `bard_*` | face, hair, build | robe, vestments, hood, staff, holy symbol, lute or instrument |
| `marksman_*` | face, hair, lean build | hooded cloak, quiver, bow, gloves, bandolier |
| `rogue_*` | face, hair, agile build | hood, mask, cloak, daggers, belts |
| `necromancer_*` | face, hair, thin build | dark robe, hood, staff, skull trinkets, glow |
| `tank_*`, `dps_*` (fallback sheets) | face, hair, build | all armour, helms, weapons, shields |
| `recruit_fighter`, `recruit_acolyte`, `recruit_thief` | face, hair, build | everything but the underclothes |

Do **one rarity of a class first** (for example `paladin_common`), compare it with `tools/gear_preview.py`, then repeat for the other three rarities. Rarity sheets of one class share a face and build, so once the first looks right the rest go quickly. Save as `public/sprites/bare/<sheet name>.png`.

### Shared preamble (paste at the top of every item below)

> 2D pixel-art **equipment overlay sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the fighter's bare sprite sheet: **a 1248 x 1248 px canvas, 6 columns x 6 rows of 208 px cells**, rows = idle (4 frames), walk (6), attack (5), cast (5), hurt (2), windup (2). Output a sheet with the **identical canvas, grid, cell positions and frame count**. Draw **only the item named below**, positioned on the fighter exactly where it would be worn or held **in every frame**, following the body's head bob, step cycle, lunge and recoil. Everything that is not the item (body, skin, hair, other clothes, shadow, ground) is **flat magenta (#FF00FF)**. The item keeps the **same size and shape in every frame** except where the pose forces it to turn or move. No anti-aliasing, no blur, no gradients, 1px dark outline in a darker shade of the item's colours (not pure black), soft top-left lighting, gentle cel shading, limited rich palette. The item must be **fully opaque** and slightly larger than the body part so none of the base shows through. Empty cells stay magenta. No text, no frame numbers, no border.

### Tier look (the same four tiers for every slot, so sets match)

| Tier | Name prefix | Look |
|---|---|---|
| 1 | **Rookie** | Dull brown leather, plain grey iron, undyed cloth. Simple, a bit scuffed. |
| 2 | **Soldier** | Brighter steel with blue-grey shading, tan leather straps, a little red cloth. Clean and sturdy. |
| 3 | **Knight** | Polished steel with **gold trim**, deep red leather and cloth, a small gem accent. Clearly a step up. |
| 4 | **Runed** | Dark blued steel with gold edging, **cyan rune lines** that glow (2 to 3 pixels, a gentle 2-frame shimmer is allowed in idle only), deep navy cloth. The best looking set but still grounded, never ornate or glowing wildly. Special shop avatar gear will be flashier than this. |

Keep gear **proportionate to a chunky 2.5-head JRPG body**: no oversized pauldrons, no weapon taller than the character.

### Weapons (main hand unless noted)

Draw the weapon in the hand the base sheet holds it with, following the swing in the attack row, the raised arm in the cast row (held as a casting focus), and a ready position in windup. In walk and idle the weapon rests naturally at the hand.

| Item | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| **Dagger** (short, about 1/3 body height, fast stabbing swing) | Rookie Dagger: short grey iron blade, wrapped brown grip | Soldier Dagger: straight steel blade, tan wrap, small crossguard | Knight Dagger: gold-capped guard, red grip, tiny gem in the pommel | Runed Dagger: dark curved blade with a cyan rune line along it, gold edge |
| **Sword** (one-handed, about 2/3 body height, wide slash) | Rookie Sword: plain iron blade, wooden grip | Soldier Sword: steel blade, blue-grey fuller, leather grip | Knight Sword: gold crossguard, red leather grip, polished blade | Runed Sword: dark steel blade, glowing cyan rune line down the fuller, gold guard |
| **Mace** (one-handed, overhead smash) | Rookie Mace: round iron head on a wooden handle | Soldier Mace: flanged steel head, leather strap | Knight Mace: gold-banded flanged head, red grip | Runed Mace: dark steel flanged head, cyan runes on the flanges, gold bands |
| **Wand** (casting focus, about half body height; in the cast row the tip is raised and **the small gem glows in 2 frames**) | Rookie Wand: knotted wooden stick, dull green crystal chip | Soldier Wand: straight polished wood, steel cap, blue crystal | Knight Wand: gold-wrapped shaft, red crystal in a gold claw | Runed Wand: dark wood with cyan runes, gold claws, bright cyan crystal |

### Shields (off hand, drawn in front of the torso; weapon is a separate layer)

The shield rides on the **off-hand forearm**. In attack the shield stays up and shifts a little with the body; in hurt it jolts back 1 to 2 px.

| Item | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| **Shield** (small round or kite, about 40% of body height) | Rookie Shield: round wooden board, iron rim and centre boss | Soldier Shield: round steel, blue-grey face, tan strap | Knight Shield: kite shape, red face, gold rim, small crest | Runed Shield: dark steel kite, gold rim, cyan rune ring |
| **Broadshield** (large tower shield, about 65% of body height, **held a little further from the body, covers most of the torso**; the character crouches slightly behind it in windup) | Rookie Broadshield: planks bound with iron straps | Soldier Broadshield: rectangular steel, riveted | Knight Broadshield: red field, gold trim and a guild-style crest | Runed Broadshield: dark steel, gold border, large glowing cyan rune sigil |

### Armour

Armour must **hug the body's silhouette** (follow the walk cycle, the breathing in idle, the stretch in attack). It may add small shapes (a skirt flap, a collar) but never changes the body's outline much, so sheets stay interchangeable.

| Item | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---|---|---|---|
| **Helmet** (covers hair; face stays visible, eyes and mouth are **not** covered; head-top only) | Rookie Cap: brown leather cap with ear flaps | Soldier Helm: steel open-faced helm, short nose guard | Knight Helm: steel with gold band and a small red plume | Runed Helm: dark steel, gold brow band, cyan rune line, short crest |
| **Top armour** (torso, shoulders and upper arms; leaves the hands bare) | Rookie Jerkin: brown leather vest over the undershirt, rough stitching | Soldier Cuirass: steel breastplate, leather pauldrons, red cloth sash | Knight Plate: gold-trimmed breastplate, red tabard, steel pauldrons with a gem | Runed Plate: dark steel plate, gold edging, glowing cyan chest rune, navy cape stub on the back (a 1px sway) |
| **Bottom armour** (hips, thighs, knees; stops above the boot) | Rookie Trousers: brown cloth trousers with leather knee wraps | Soldier Greaves: steel thigh plates, tan straps | Knight Cuisses: gold-trimmed steel, red cloth skirt flap | Runed Cuisses: dark steel, gold edge, small cyan rune on each thigh, navy flap |
| **Boots** (feet and shins only, cover the bare feet fully, same step cycle) | Rookie Boots: scuffed brown leather ankle boots | Soldier Boots: tall leather boots with steel toe caps | Knight Boots: steel shin guards, gold buckles, red cuffs | Runed Boots: dark steel greaves, gold trim, cyan rune at the ankle |

### Per-item prompt (fill in and send)

> [shared preamble] **Item: {tier name} {item}** ({description from the tables above}). Reference sheet attached: {novice_male / novice_female}. Draw this item only. Magenta everywhere else.

That makes 40 overlay sheets per body (24 weapons and shields: dagger, sword, mace, wand, shield, broadshield, 4 tiers each = 24; 16 armour pieces). If 40 per body is too many to run at once, do **tier 1 and 2 first**.

Save as `public/gear/<body>/<slot>_<item>_<tier>.png`, for example `public/gear/novice_male/weapon_sword_2.png`, `armor_helmet_3.png`. When the first set is in, the game side gets a layered `FighterSprite`, equipment slots, bag integration, stats and the shop.

---

## B. Potion and stone icons

Same format as the monster-drop sheet (`tools/build_items.py`): **one image, 5 columns x 2 rows of icons**, each icon about 128 px, centred in its cell on flat **magenta (#FF00FF)**, read left to right, top row first. Match the look of the existing `hp_potion.png` and `mp_potion.png` icons (same outline weight, shading and glass style).

> 2D pixel-art item icons in the style of Chained Echoes and 16-bit JRPGs. A sheet of **10 icons in a 5 x 2 grid**, equal square cells on a flat magenta (#FF00FF) background, each icon centred, about 110 px, nothing touching the cell edge. No shadows, no ground, no text, no numbers, no border. Crisp hard pixel edges, no anti-aliasing, 1px dark outline in a darker shade of each colour, soft top-left lighting, small white specular highlight on the glass.
>
> **Row 1, health potions (red liquid):**
> 1. **Small Health Potion:** a tiny round-bottomed vial, cork stopper, red liquid about half full.
> 2. **Medium Health Potion:** a rounder flask, cork stopper, red liquid nearly full, a little bigger than the small one.
> 3. **Large Health Potion:** a large round flask with a long neck, a leather strap tied round the neck, red liquid full, with a faint pink glow dot.
> 4. **Max Health Potion:** a tall ornate bottle with gold rim and a gold-wrapped neck, bright glowing red liquid, **two tiny sparkles** beside it. The biggest of the four.
> 5. **Revive Potion:** a slim crystal vial with a **gold liquid** and a tiny white feather floating inside, a gold cap, a soft golden glow, a tiny white sparkle.
>
> **Row 2, mana potions (blue liquid):**
> 6. **Small Mana Potion:** same vial as #1 but with blue liquid.
> 7. **Medium Mana Potion:** same flask as #2, blue liquid.
> 8. **Large Mana Potion:** same flask as #3, blue liquid, strap in blue-grey.
> 9. **Max Mana Potion:** same ornate bottle as #4, glowing bright blue liquid, two sparkles.
> 10. **Teleport Stone:** a flat, smooth, oval **pale violet stone** with a glowing cyan rune carved in the middle, a few tiny cyan sparkles around it, a thin gold wire loop at the top.
>
> Within a row, the four sizes must clearly **grow in size and detail** left to right, so a player can tell S, M, L and Max apart at 40 px.

Run `python3 tools/build_items.py --potions <sheet.png>`; it cuts the ten icons and updates the art list automatically.

---

## C. Alchemist (turns monster parts into items)

Same three-facing sheet as the merchant, secretary and gladiator (see `docs/npc-sprite-prompts.md`, "Shared format for the Merchant, Secretary and Gladiator"): 3 rows (front, left, right) x 6 columns, 1254 x 627 px, 209 px cells, magenta background, feet on the same baseline, frame 6 flows back into frame 1.

> [three-facing format] A **guild alchemist**: a slender woman in her thirties with a messy copper-brown bun held with two pencils, round brass goggles pushed up on her forehead, a bit of soot on one cheek, a bright curious grin. She wears a **deep teal long coat with the sleeves rolled**, a stained cream apron over it with many pockets, a belt of small glass vials and a **dried bat wing and a goblin ear tied to the belt as trophies**, brown gloves, tall boots. Row 1 front-facing; rows 2 and 3 in profile (the vial belt and a small satchel on the hip are visible from the side, the bun sticks out the back). In both hands she holds **a glass flask with a swirling green liquid** at chest height.
>
> Animation, 6 frames, mixing idle:
> 1. Rest pose, flask at chest height, liquid level.
> 2. Swirls the flask gently, the green liquid tilts (a 1 to 2 pixel tilt), eyes follow it.
> 3. Holds it up to the light, squints through it, one eyebrow raised.
> 4. A single **tiny bubble pops** above the flask (2 pixels), she grins and nods.
> 5. Lowers the flask, a quick glance to the side, the coat hem sways 1 px.
> 6. Exhale, shoulders settle, goggles slip down a pixel and she pushes them up (matches frame 1).

### Cauldron prop (the alchemist stands beside it; combining happens here)

> 2D pixel-art prop sprite, Chained Echoes style, front-facing, on a magenta (#FF00FF) background. A **squat black iron cauldron with brass rivets** on three short legs over a small **glowing orange coal fire** (a couple of logs). Teal-green liquid inside, a wooden ladle leaning on the rim, **3 small hanging bundles of dried herbs** on a short iron hook beside it. One horizontal row of **4 frames, 836 x 209 px (209 px cells)**: the liquid surface bubbles (a bubble grows and pops differently in each frame), the fire flickers, a thin wisp of steam rises and drifts 1 pixel each frame. The cauldron itself never moves. No shadow, no ground, no text. Crisp hard pixels, 1px dark outline, soft top-left lighting.

Save as `public/npc/alchemist.png` (and `public/town-src/cauldron.png` for the prop). Once it is in, the alchemist goes into the market and the crafting menu follows (part recipes: for example three Slimeballs + one Sporedust for a Small Health Potion).
