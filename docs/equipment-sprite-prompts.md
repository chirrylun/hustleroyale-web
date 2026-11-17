# Equipment, potion and alchemist art prompts

Three parts: (A) equipment overlay sheets, (B) potion and stone icons, (C) the alchemist (plus her cauldron).
Look: 2D pixel art in the style of Chained Echoes / 16-bit JRPGs, the same as the fighter sheets.

---

## A. Equipment overlays

### Plan: two bodies only

Every fighter is the **novice male or novice female** body, so all gear is made on just those two. Class identity then comes from the gear a fighter wears. (The existing class sheets stay in the game for now; they would only be replaced once gear is in.)

- **Overlay sheet = one item**, 1248 x 1248 px, 6 x 6 cells of 208 px, same layout as the fighter sheets: idle (4), walk (6), attack (5), cast (5), hurt (2), windup (2). Only the item is drawn, everything else is flat magenta.
- **Make every item twice**: once with the **bare male** sheet attached, once with the **bare female** sheet attached. The prompt text is identical; only the attached sheet changes. Gear is drawn to the body's own silhouette, so the two will differ slightly in fit.
- Layer order in the game, bottom to top: boots, bottom armour, top armour, helmet, weapon; the shield rides in front of the torso.
- Check with `python3 tools/gear_preview.py <bare sheet> <overlay> [more overlays] -o out.png`.
- Save as `public/gear/<male|female>/<slot>_<item>_<tier>.png`, for example `public/gear/male/weapon_sword_2.png`, `armor_helmet_3.png`.
- Do tiers 1 and 2 first.

### Step 0: the bare base sheets (once each, for male and female)

> Attach `public/sprites/novice_male.png` (then again with `novice_female.png`). Redraw **exactly the same sheet**: same 1248 x 1248 canvas, same 6 x 6 grid of 208 px cells, same poses, same frame positions, same body size and the **same feet baseline in every frame**. Keep the fighter's own **face, hair, skin tone and build**. Strip them to plain cloth underclothes: a short-sleeved off-white undershirt and simple brown shorts to the knee, **bare feet, no hat, no armour, no gloves, no belt or pouches, no weapon, no shield**. Hands are **empty and slightly curled** where they held something, and the attack, cast and windup rows keep the same arm motion as if swinging or casting with an empty hand. Plain flat magenta (#FF00FF) background, crisp hard pixel edges, no anti-aliasing, 1px dark outline, no shadow, no ground, no text.

Save as `public/sprites/bare/novice_male.png` and `novice_female.png`.

### Shared prompt (paste this first, every time)

> 2D pixel-art **equipment overlay sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the fighter's bare sprite sheet: **a 1248 x 1248 px canvas, 6 columns x 6 rows of 208 px cells**, rows = idle (4 frames), walk (6), attack (5), cast (5), hurt (2), windup (2). Output a sheet with the **identical canvas, grid, cell positions and frame count**. Draw **only the item named below**, positioned on the fighter exactly where it is worn or held **in every frame**, following the body's head bob, step cycle, lunge and recoil. Everything that is not the item (body, skin, hair, other clothes, shadow, ground) is **flat magenta (#FF00FF)**. The item keeps the **same size and shape in every frame** except where the pose forces it to turn or move. No anti-aliasing, no blur, no gradients, 1px dark outline in a darker shade of the item's colours (not pure black), soft top-left lighting, gentle cel shading, limited rich palette. The item is **fully opaque** and a touch larger than the body part so none of the base shows through. Gear is proportionate to a chunky 2.5-head JRPG body: no oversized pauldrons, no weapon taller than the character. Empty cells stay magenta. No text, no frame numbers, no border.
>
> **Tier looks.** **Rookie:** dull brown leather, plain grey iron, undyed cloth, a bit scuffed. **Soldier:** bright steel with blue-grey shading, tan leather straps, a little red cloth, clean and sturdy. **Knight:** polished steel with gold trim, deep red leather and cloth, one small gem accent. **Runed:** dark blued steel with gold edging, glowing cyan rune lines 2 to 3 px wide (a gentle 2-frame shimmer in idle only), deep navy cloth; the best looking tier but grounded, never flashy.

### The item prompts (paste one after the shared prompt)

**Dagger**

> **Rookie Dagger**: a short dagger, about one third of the body height, in the main hand (a fast stab in attack, held up as a casting focus in cast). Design: short grey iron blade, wrapped brown grip. Use the Rookie tier look.

> **Soldier Dagger**: a short dagger, about one third of the body height, in the main hand (a fast stab in attack, held up as a casting focus in cast). Design: straight steel blade, tan grip wrap, small crossguard. Use the Soldier tier look.

> **Knight Dagger**: a short dagger, about one third of the body height, in the main hand (a fast stab in attack, held up as a casting focus in cast). Design: gold-capped guard, red grip, tiny gem in the pommel. Use the Knight tier look.

> **Runed Dagger**: a short dagger, about one third of the body height, in the main hand (a fast stab in attack, held up as a casting focus in cast). Design: dark curved blade with a cyan rune line, gold edge. Use the Runed tier look.

**Sword**

> **Rookie Sword**: a one-handed sword, about two thirds of the body height, in the main hand (a wide slash in attack). Design: plain iron blade, wooden grip. Use the Rookie tier look.

> **Soldier Sword**: a one-handed sword, about two thirds of the body height, in the main hand (a wide slash in attack). Design: steel blade with a blue-grey fuller, leather grip. Use the Soldier tier look.

> **Knight Sword**: a one-handed sword, about two thirds of the body height, in the main hand (a wide slash in attack). Design: polished blade, gold crossguard, red leather grip. Use the Knight tier look.

> **Runed Sword**: a one-handed sword, about two thirds of the body height, in the main hand (a wide slash in attack). Design: dark steel blade, glowing cyan rune down the fuller, gold guard. Use the Runed tier look.

**Mace**

> **Rookie Mace**: a one-handed mace in the main hand (an overhead smash in attack). Design: round iron head on a wooden handle. Use the Rookie tier look.

> **Soldier Mace**: a one-handed mace in the main hand (an overhead smash in attack). Design: flanged steel head, leather strap. Use the Soldier tier look.

> **Knight Mace**: a one-handed mace in the main hand (an overhead smash in attack). Design: gold-banded flanged head, red grip. Use the Knight tier look.

> **Runed Mace**: a one-handed mace in the main hand (an overhead smash in attack). Design: dark steel flanged head with cyan runes, gold bands. Use the Runed tier look.

**Wand**

> **Rookie Wand**: a casting wand, about half the body height, in the main hand (in cast the tip is raised and the crystal glows over 2 frames). Design: knotted wooden stick, dull green crystal chip. Use the Rookie tier look.

> **Soldier Wand**: a casting wand, about half the body height, in the main hand (in cast the tip is raised and the crystal glows over 2 frames). Design: straight polished wood, steel cap, blue crystal. Use the Soldier tier look.

> **Knight Wand**: a casting wand, about half the body height, in the main hand (in cast the tip is raised and the crystal glows over 2 frames). Design: gold-wrapped shaft, red crystal in a gold claw. Use the Knight tier look.

> **Runed Wand**: a casting wand, about half the body height, in the main hand (in cast the tip is raised and the crystal glows over 2 frames). Design: dark wood with cyan runes, gold claws, bright cyan crystal. Use the Runed tier look.

**Shield**

> **Rookie Shield**: a small shield, about 40% of the body height, on the off-hand forearm, drawn in front of the torso (kept up in attack, jolts back 1 to 2 px in hurt). Design: round wooden board, iron rim and centre boss. Use the Rookie tier look.

> **Soldier Shield**: a small shield, about 40% of the body height, on the off-hand forearm, drawn in front of the torso (kept up in attack, jolts back 1 to 2 px in hurt). Design: round steel, blue-grey face, tan strap. Use the Soldier tier look.

> **Knight Shield**: a small shield, about 40% of the body height, on the off-hand forearm, drawn in front of the torso (kept up in attack, jolts back 1 to 2 px in hurt). Design: kite shape, red face, gold rim, small crest. Use the Knight tier look.

> **Runed Shield**: a small shield, about 40% of the body height, on the off-hand forearm, drawn in front of the torso (kept up in attack, jolts back 1 to 2 px in hurt). Design: dark steel kite, gold rim, ring of cyan runes. Use the Runed tier look.

**Broadshield**

> **Rookie Broadshield**: a large tower shield, about 65% of the body height, on the off-hand, held a little away from the body so it covers most of the torso, drawn in front (the character crouches behind it in windup). Design: planks bound with iron straps. Use the Rookie tier look.

> **Soldier Broadshield**: a large tower shield, about 65% of the body height, on the off-hand, held a little away from the body so it covers most of the torso, drawn in front (the character crouches behind it in windup). Design: riveted rectangular steel. Use the Soldier tier look.

> **Knight Broadshield**: a large tower shield, about 65% of the body height, on the off-hand, held a little away from the body so it covers most of the torso, drawn in front (the character crouches behind it in windup). Design: red field, gold trim and a crest. Use the Knight tier look.

> **Runed Broadshield**: a large tower shield, about 65% of the body height, on the off-hand, held a little away from the body so it covers most of the torso, drawn in front (the character crouches behind it in windup). Design: dark steel, gold border, large glowing cyan sigil. Use the Runed tier look.

**Helmet**

> **Rookie Helmet**: a helmet that covers the hair, top of the head only; the eyes and mouth stay visible. Design: leather cap with ear flaps. Use the Rookie tier look.

> **Soldier Helmet**: a helmet that covers the hair, top of the head only; the eyes and mouth stay visible. Design: open-faced steel helm, short nose guard. Use the Soldier tier look.

> **Knight Helmet**: a helmet that covers the hair, top of the head only; the eyes and mouth stay visible. Design: steel helm, gold band, small red plume. Use the Knight tier look.

> **Runed Helmet**: a helmet that covers the hair, top of the head only; the eyes and mouth stay visible. Design: dark steel helm, gold brow band, cyan rune line, short crest. Use the Runed tier look.

**Top Armour**

> **Rookie Top Armour**: armour for the torso, shoulders and upper arms; the hands stay bare; it hugs the body outline and follows the idle breathing and the stretch in attack. Design: rough leather vest with visible stitching. Use the Rookie tier look.

> **Soldier Top Armour**: armour for the torso, shoulders and upper arms; the hands stay bare; it hugs the body outline and follows the idle breathing and the stretch in attack. Design: steel breastplate, leather pauldrons, red cloth sash. Use the Soldier tier look.

> **Knight Top Armour**: armour for the torso, shoulders and upper arms; the hands stay bare; it hugs the body outline and follows the idle breathing and the stretch in attack. Design: gold-trimmed breastplate, red tabard, steel pauldrons with a gem. Use the Knight tier look.

> **Runed Top Armour**: armour for the torso, shoulders and upper arms; the hands stay bare; it hugs the body outline and follows the idle breathing and the stretch in attack. Design: dark plate, gold edging, glowing cyan chest rune, a navy cape stub on the back that sways 1 px. Use the Runed tier look.

**Bottom Armour**

> **Rookie Bottom Armour**: armour for the hips, thighs and knees, stopping above the boot; it follows the walk cycle. Design: brown cloth trousers with leather knee wraps. Use the Rookie tier look.

> **Soldier Bottom Armour**: armour for the hips, thighs and knees, stopping above the boot; it follows the walk cycle. Design: steel thigh plates with tan straps. Use the Soldier tier look.

> **Knight Bottom Armour**: armour for the hips, thighs and knees, stopping above the boot; it follows the walk cycle. Design: gold-trimmed steel cuisses, red cloth skirt flap. Use the Knight tier look.

> **Runed Bottom Armour**: armour for the hips, thighs and knees, stopping above the boot; it follows the walk cycle. Design: dark steel cuisses, gold edge, a small cyan rune on each thigh, navy flap. Use the Runed tier look.

**Boots**

> **Rookie Boots**: boots that fully cover the feet and shins, following the same step cycle as the bare feet. Design: scuffed brown leather ankle boots. Use the Rookie tier look.

> **Soldier Boots**: boots that fully cover the feet and shins, following the same step cycle as the bare feet. Design: tall leather boots with steel toe caps. Use the Soldier tier look.

> **Knight Boots**: boots that fully cover the feet and shins, following the same step cycle as the bare feet. Design: steel shin guards, gold buckles, red cuffs. Use the Knight tier look.

> **Runed Boots**: boots that fully cover the feet and shins, following the same step cycle as the bare feet. Design: dark steel greaves, gold trim, cyan rune at the ankle. Use the Runed tier look.

That is 40 items, times two bodies.

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
