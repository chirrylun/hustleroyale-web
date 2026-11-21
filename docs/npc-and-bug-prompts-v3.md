# NPC refresh and the floor 4 bug mob (prompts)

## A. NPC refresh: Secretary, Gladiator, Alchemist (same characters, new look)

The merchant, guard, class changer and storage keeper sheets are the approved look. The secretary and gladiator sheets are older: smaller figures, thinner, flatter shading. These prompts keep the **same characters and the same idle gestures** as `docs/npc-sprite-prompts.md` and only change the format block, which pins the look to the approved sheets.

**Attach with every prompt:** `public/npc/merchant.png` and `public/npc/guard.png` as style references. (For the Secretary, attach the old `secretary.png` as well and say "same character, redrawn in the style of the first two sheets".)

### Shared format v3 (paste first)

```
2D pixel-art character sheet in the style of Chained Echoes and 16-bit JRPGs, matching the two attached approved sheets (merchant and guard) exactly in style. One character in three facings, one per row: 3 rows x 6 columns = 18 frames, each cell 209 x 380 px, total canvas 1254 x 1140 px.
Row 1: facing the camera (front view). Row 2: facing LEFT (side view, nose pointing to the left edge). Row 3: facing RIGHT (side view, nose pointing to the right edge), a mirror-quality match of row 2 with held items on the correct hands. Each row is a 6-frame idle loop of the same gesture; frame 6 flows back into frame 1.
Scale and placement: the character is about 340 px tall in every frame of every row (head to feet), feet on the same baseline y=360 of the cell, centred horizontally in the cell, the same size in all 18 frames, so switching facing or looping never jitters. Leave 20 px empty above the head and below the feet; never touch a cell edge.
Look, copy the attached sheets: chunky proportions with a large head (head about 36% of the total height), big readable eyes, a small mouth, rich saturated colours, soft cel shading with a lighter top-left rim, tiny 1 px white highlights on metal, glass and eyes, crisp visible pixels (each pixel block about 3 canvas px), 1 px dark outline in a darker shade of each colour (not pure black). Plain flat magenta #FF00FF background, no shadow, no ground, no text, no border, no frame numbers, no motion effects except the tiny sparkle or sway marks the gesture list asks for.
```

### Secretary (beside the job board)

```
[shared format v3] A neat, bright guild secretary (woman): a navy blue guild uniform jacket with gold buttons and a white collar, a long dark skirt, brown boots, a blue ribbon on a pinned brown hair bun, round glasses. A brown leather satchel on her hip and a quill pen behind her ear. Row 1 front-facing; rows 2 and 3 in profile (the bun with its ribbon, the satchel and the quill behind the ear are clearly visible from the side). She holds a clipboard with parchment (visible lines of writing) against her chest in one arm and a white quill pen in the other hand.
Animation, 6 frames, busy-but-welcoming idle:
1. Rest pose, quill raised near the page.
2. Looks down at the clipboard, quill touches the parchment.
3. Writes, quill moves 2 px, small head tilt.
4. Looks up and gives a small smile, quill lifted.
5. Pushes her glasses up with the free hand.
6. Hand returns, blinks once, back to the rest pose.
```

### Gladiator (beside the arena)

```
[shared format v3] A tough arena gladiator: muscular, tanned skin, a shaved head with a short dark beard and a scar over one eye. A bronze segmentata shoulder guard on one shoulder only with a small red plume, a leather harness across the chest, a red sash and red waist cloth over a leather pteruges skirt, bronze greaves, wrapped leather sandals, a bronze arm guard, a dented bronze round shield strapped to his back, a short gladius sword hanging at his belt. Wide stance, arms crossed on his chest. Row 1 front-facing; rows 2 and 3 in profile (the shield on his back, the one-sided shoulder guard and the plume are clearly visible from the side). Keep his body to the same chunky large-head proportions as the guard sheet; do not draw him taller or thinner than the guard.
Animation, 6 frames, proud and restless idle:
1. Rest pose, arms crossed, wide stance.
2. Chest swells, chin lifts a pixel.
3. One hand uncrosses and rolls the shoulder, the other stays on the sash.
4. Rolls the neck to the side, plume sways.
5. Smirks, one eyebrow up, weight shifts to the other foot.
6. Arms re-cross, exhale, back to the rest pose.
```

### Alchemist (new, for the market)

```
[shared format v3] A guild alchemist: a slender woman in her thirties with a messy copper-brown bun held with two pencils, round brass goggles pushed up on her forehead, a bit of soot on one cheek, a bright curious grin. A deep teal long coat with the sleeves rolled, a stained cream apron with many pockets, a belt of small glass vials with a dried bat wing and a goblin ear tied to it as trophies, brown gloves, tall boots. Row 1 front-facing; rows 2 and 3 in profile (the vial belt, a small satchel on the hip and the bun sticking out the back are visible from the side). Both hands hold a glass flask of swirling green liquid at chest height.
Animation, 6 frames, mixing idle:
1. Rest pose, flask at chest height, liquid level.
2. Swirls the flask gently, the green liquid tilts 1 to 2 px, eyes follow it.
3. Holds it up to the light, squints through it, one eyebrow raised.
4. A single tiny bubble (2 px) pops above the flask, she grins and nods.
5. Lowers the flask, a quick glance to the side, the coat hem sways 1 px.
6. Exhale, shoulders settle, goggles slip a pixel and she pushes them up (matches frame 1).
```

Save as `public/npc/secretary.png`, `gladiator.png`, `alchemist.png`; tell me when they are in and I will size them in `npcs.json` like the others.

---

## B. Floor 4 bug mob (a flying insect)

Same sheet as every other mob (see the bat): **1248 x 1248 px, 6 x 6 grid of 208 px cells, flat magenta #FF00FF background** (or transparent), the creature **facing right**, rows = idle (4 frames), walk (6), attack (5), cast (5), hurt (2), windup (2). Four rarities (common, uncommon, rare, legendary) as separate sheets, like the other mobs: make **common first**, then attach it and ask for each variant.

For a flier the "feet baseline" is its hover height: the body centre sits at **x=104, y=105** in every cell, the body about **90 px long**, the wings add width but never leave the cell. Nothing may touch a cell edge.

### Shared mob prompt (paste first, every time)

```
2D pixel-art monster sprite sheet in the style of Chained Echoes and 16-bit JRPGs, matching the attached bat and mushroom mob sheets in line weight, shading and chunkiness. Canvas 1248 x 1248 px, 6 columns x 6 rows of 208 px cells, flat magenta #FF00FF background, no shadow, no ground, no text, no numbers, no border. The creature faces RIGHT in every frame. Rows: row 1 idle (4 frames), row 2 walk / fly (6), row 3 attack (5), row 4 cast (5), row 5 hurt (2), row 6 windup (2); unused cells stay flat magenta. In every frame the body centre is at x=104, y=105 of its cell, the body about 90 px long, the same size in all frames; only wings, legs, stinger and the pose change. Wings are drawn as solid shapes (fully opaque, with a few lighter vein lines), never as blurred streaks; no motion blur, no speed lines. Crisp hard pixel edges, no anti-aliasing, 1 px dark outline in a darker shade of each colour (not pure black), soft top-left light, gentle cel shading, limited rich palette. Cute-but-threatening chunky proportions with a big head and big eyes, like the bat.
```

### Common: the Buzzer (a chunky flying beetle with a stinger)

```
The creature: the "Buzzer", a round chunky flying beetle about the size of a melon: a glossy olive-green shell split into two wing cases, a small amber head with two big black eyes with a white highlight, two short curved antennae, two tiny mandibles, six short dark legs tucked under the belly, a striped amber-and-black abdomen ending in a short sharp stinger pointing back-down, and two translucent pale-green wings with white veins.
Row 1 idle: it hovers in place, the body bobbing 3 px up and down, wings flapping between two clear poses (up, down) over 4 frames, antennae twitching.
Row 2 fly: it drifts to the right, the body tilted 10 degrees nose-down, 6 frames of wing flapping and bobbing, legs dangling.
Row 3 attack: a sting dive: frame 1 pulls back and rears up, frame 2 tilts nose-down, frame 3 lunges forward with the stinger thrust forward and mandibles open, frame 4 at full extension, frame 5 recovers.
Row 4 cast: it spits venom: it rears back, the abdomen swells and glows a little brighter, then it lunges and a small toxic-green blob (about 14 px, inside the cell) shoots out of the stinger; frame 5 recovers. A few tiny green droplets are allowed here, nothing else.
Row 5 hurt: frame 1 flinches back, eyes squeezed shut, wings crumpled, a small 4-line impact mark; frame 2 wobbling, one wing drooping.
Row 6 windup: frame 1 pulls its abdomen forward under itself and cocks the stinger, wings folded up; frame 2 coiled tighter, antennae flat.
```

### Rarity variants (attach the approved common sheet, then paste one)

```
Same sheet as the attached common Buzzer: identical poses, frame positions, body size and centre in every cell, only the colours and details change. Uncommon "Hive Buzzer": a deep teal shell with amber stripes, a gold ring marking on the head, slightly longer stinger.
```
```
Same sheet as the attached common Buzzer: identical poses, frame positions, body size and centre in every cell, only the colours and details change. Rare "Venom Buzzer": a dark purple shell with glowing lime-green spots and veins, bright green wings, a dripping lime stinger tip.
```
```
Same sheet as the attached common Buzzer: identical poses, frame positions, body size and centre in every cell, only the colours and details change. Legendary "Queen Buzzer": a black and gold shell, a small gold crown-like crest on the head, bigger wings with gold veins, a glowing orange stinger, a few 1 px golden sparkles kept inside the outline of the body.
```

Save the folder as `bug/bug/<file>.png` per rarity (or `mob_bug_<rarity>.png`) and I will run the mob build, then add the `bug` mob to floor 4 (spawn weights, drops and the bug part item).
