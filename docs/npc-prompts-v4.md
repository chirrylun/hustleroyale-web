# NPC sheet prompts v4 (match the new Gladiator)

The Gladiator you generated is the reference look: chunky 2.5-head JRPG body, large expressive bearded face, rich painted shading, dark plum outline. These prompts redraw the other NPCs in that style and add the **Alchemist** and **Blacksmith** (enhancing). Attach `public/npc/gladiator.png` (or your original Gladiator image) as the style reference with every prompt.

## Layout (what the importer reads)
Row 1: **6 front-facing idle frames**. Row 2: **6 frames facing RIGHT** (3/4 side view). I mirror row 2 for the left facing, so you do not need a left row. 1024 x 1024 canvas is fine; loose spacing is fine (the importer finds each figure). Import with `python3 tools/build_npc_loose.py <name> <sheet> <row1 y0> <row1 y1> <row2 y0> <row2 y1>`.

## Shared format (paste first)
> 2D pixel-art character sheet in the style of the attached Gladiator reference: chunky JRPG proportions with a slightly oversized head, detailed painted pixel shading, soft top-left lighting, a dark plum outline, crisp hard pixel edges. **Two rows of 6 idle frames.** Row 1: the character facing the camera. Row 2: the same character facing right in a 3/4 side view, same gesture. The character is the same size in every frame (about 150 px tall) and stands on the same baseline. Plain flat magenta (#FF00FF) background, no ground, no shadow, no text, no frame numbers. The six frames are a gentle idle loop (frame 6 flows into frame 1); keep the held props in the same hand and the same size throughout.

## 1. Guild Secretary (job board)
> [shared format] A neat, bright guild secretary (woman): navy guild uniform jacket with gold buttons and a white collar, long dark skirt, brown boots, small blue hair ribbon, brown hair in a bun, round glasses, leather satchel on her hip, a quill behind her ear. One arm hugs a clipboard of parchment to her chest; the other hand holds a quill.
> Frames: 1 rest, quill near the page; 2 looks down, quill touches the page; 3 writes, small head tilt; 4 looks up with a small smile; 5 pushes her glasses up; 6 hand returns, blink.

## 2. Merchant (market)
> [shared format] A cheerful travelling merchant: wide-brimmed brown felt hat with a feather, dark green vest over a cream shirt with rolled sleeves, brown pocketed apron, leather gloves, big brown backpack with a rolled map, cloth bundle and hanging pots, coin pouch on the belt. Round friendly face, short moustache, rosy cheeks. One hand holds a small glass potion bottle at chest height, the other rests on his hip. In the side row the backpack and pots are clearly visible and the hat feather points backwards.
> Frames: 1 rest; 2 lifts the potion, 1-pixel sparkle on the glass; 3 potion at shoulder height, a wink; 4 holds it up, other hand taps the coin pouch, pots swing 1 px; 5 lowers it, hat tips forward 1 px; 6 settles.

## 3. Guard (town gate / armourer)
> [shared format] A stern but fair town guard: steel half-plate over a blue surcoat with a gold shield crest, open-faced steel helm with a short red crest, steel gauntlets, a short brown cloak, a short sword at the hip. He holds a tall spear upright in his right hand, butt on the ground, left hand on his belt. Square jaw, short dark stubble.
> Frames: 1 rest, upright; 2 chest rises, eyes glance left; 3 glances right; 4 shifts weight, spear tilts 3 px; 5 straightens, spear back; 6 exhale, cloak sways 1 px.

## 4. Class Changer (lobby)
> [shared format] A calm guild class master (woman in her forties): long deep-purple and teal robe with gold embroidery of crossed symbols (sword, staff, bow, shield) on the hem and sleeves, a small stack of folded tabards on one forearm, silver-streaked black hair in a long braid over one shoulder, small gold earrings, a key ring and brass emblem pendant at the belt. A glowing blue-white hexagonal class crystal floats above her open palm.
> Frames: 1 rest; 2 crystal brightens, head tilts; 3 crystal rises 2 px and shifts to gold; 4 a tiny ring of light, free hand offers a choice; 5 crystal settles to blue, small smile; 6 exhale, hem sways 1 px.

## 5. Storage Keeper (lobby storage)
> [shared format] A sturdy friendly warehouse keeper (stocky middle-aged man): brown leather apron over a cream shirt with rolled sleeves, dark green vest, heavy boots, tool belt with a hammer and a lantern hook, large iron key ring at the hip, flat tan cap, thick brown moustache, ruddy cheeks, a rolled receipt behind his ear. A small wooden crate with a rope handle on one hip, a tally ledger in the other hand.
> Frames: 1 rest; 2 lifts the ledger and reads; 3 taps it twice with a pencil, eyebrows up; 4 looks up and nods, keys jingle; 5 hitches the crate higher with a small bounce; 6 settles, exhale.

## 6. Guild Manager (tutorial guide, front only: row 1 only, 6 frames)
> [shared format, row 1 only] A veteran guild manager dressed like a paladin: polished silver plate with gold trim, deep blue tabard with a small gold shield crest, short blue cape, steel gauntlets and greaves, brown belt, helmet clipped at the belt. Weathered kind face, short grey-brown hair and neat grey beard. He leans on a large flanged mace held in both hands in front of him, head resting on the ground.
> Frames: 1 rest; 2 head tilts, brows up; 3 right hand lifts and opens, palm up; 4 hand out, mace tilts 10 degrees, small nod; 5 hand returns; 6 exhale, cape sways 1 px.

## 7. Alchemist (market, potions) NEW
> [shared format] A guild alchemist: slender woman in her thirties, messy copper-brown bun held with two pencils, round brass goggles pushed up on her forehead, soot on one cheek, a curious grin. Deep teal long coat with rolled sleeves, stained cream apron with many pockets, a belt of small glass vials with a dried bat wing and a goblin ear tied on as trophies, brown gloves, tall boots, small satchel on the hip. Both hands hold a glass flask of bubbling green liquid at chest height. In the side row the bun, vial belt and satchel stick out clearly.
> Frames: 1 rest, liquid level; 2 flask lifts, a bubble rises; 3 she swirls it, liquid turns teal; 4 a puff of pink vapour (2 px), she leans back with a grin; 5 holds it to the light, one eye squinting; 6 settles, liquid green again.

## 8. Blacksmith (enhancing, forge) NEW
> [shared format] A broad-shouldered master blacksmith: tanned skin, bald head with a thick red-brown braided beard, a burn scar on one forearm, kind but serious eyes. Thick brown leather apron scorched at the edges over a bare chest and a dark grey sleeveless tunic, leather wrist guards, heavy gloves, a hammer and tongs on a belt loop, soot on the cheeks. In his right hand a **heavy smithing hammer**, in his left **tongs gripping a glowing orange sword blade** resting on a small portable anvil block in front of him (the anvil is part of the sprite, stays in place).
> Frames: 1 rest, hammer raised halfway; 2 hammer lifts high, blade glows brighter; 3 strike: hammer down on the blade, 3 orange sparks (1-2 px) fly; 4 hammer rebounds up, sparks fade; 5 he turns the blade a little with the tongs and blows on it, head tilts; 6 settles, hammer halfway again (matches frame 1).
> Tip: keep the blade glow orange only on the blade so it does not tint the rest of the sprite.
