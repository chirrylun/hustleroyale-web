# Guild ranks 1-4: hall backgrounds, props sheets and the Carpenter

Style reference for every image: attach `public/guild/hall.png` (the current hall) and `public/town/props.png`. Same pipeline as before: backgrounds are empty, props come on magenta sheets and are placed in code from `layout.json`.

## Hall facts the art must respect
- Canvas **1600 x 896** (25 x 14 tiles of 64 px). Back wall = top 3 tiles (192 px); floor below.
- These stay where they are, so leave **clear wall space / clear floor** for them in every rank: Adventure map (x1.3,y4.7), Trophy (wall, x4.3), Job Board (wall, x11.2), two banners (x9.7 and x15.3), Market door (wall, x16.9), Stairs to Lobby (wall, x20.6), training yard bottom-left (scarecrow, target, rack, x1-8, y9-12).
- Fighters walk the open floor in the middle: keep a clear walkway from the stairs down to the training yard.

## Shared look (paste first)
> 2D pixel-art in the style of the attached guild hall: Chained Echoes / 16-bit JRPG, warm slightly desaturated palette, dark plum outlines, chunky readable shapes, soft light from the upper left, top-down three-quarter view (camera about 45 degrees). No text, no UI, no characters.

## The 4 ranks (one idea each, same room, same layout, only the materials and wealth change)
1. **Humble Lodge**: patched timber and plain planks, bare stone, a few candles. Tidy but poor.
2. **Established Hall**: clean oak planks, whitewashed plaster, a rug, iron lanterns, a hearth.
3. **Prosperous Hall**: dark polished wood, stone pillars, banners, brass fittings, a large rug, stained-glass window.
4. **Grand Guildhall**: marble and gold inlay, crimson carpet runner, chandelier light, tall arched windows, gilded trim.

## A. Hall backgrounds (4 images, one per rank)
> [shared look] An **empty guild hall interior**, canvas **1600 x 896 px**. **Top 192 px: the back wall**, flat and clear (no doors, windows, banners or shelves painted on, those are placed later) with a wainscot band and a skirting board. **Below: the floor**, with a rug in the central walkway. Side walls only as a thin dark edge. Leave the floor free of furniture. **Rank [N] look:** [paste one rank line below].
- **Rank 1:** uneven dark-brown plank floor with a few mismatched boards, grey stone back wall with timber posts, a small frayed brown rug, cobweb in one corner.
- **Rank 2:** even honey-oak planks, whitewashed plaster wall with dark beams, a red-brown woven rug with a simple border, an iron wall sconce rail along the wall.
- **Rank 3:** dark polished walnut floor with a diamond pattern, stone-block wall with carved pilasters every 4 tiles, a large navy and gold rug, brass skirting.
- **Rank 4:** pale marble floor with a gold-inlay border and a crimson carpet runner down the middle, cream marble wall with gilded columns and arched recesses, warm chandelier glow on the floor (soft, no object drawn).

## B. Props sheets (one per rank, 4 images)
> [shared look] A **sprite sheet of 16 separate objects on flat magenta (#FF00FF)**, canvas **1254 x 1254 px**, a **4 x 4 grid** of equal cells, one object per cell, centred with a clear margin, soft contact shadow, drawn at the same scale as the existing hall props (a barrel is about 60 px wide). Materials match **rank [N]** (see rank lines above). No text. Objects, left to right, top to bottom, are listed per rank; the groups make sense together as zones.

**Zones used in all ranks:** Reception (desk, rug, notice stand) · Rest quarters (bunks, chests, lamp) · Dining and social (table, stools, hearth) · Records and study (shelves, lectern, globe) · Decor (plants, wall pieces).

### Rank 1 sheet (Humble Lodge)
> Row 1 (Reception): small plain wooden reception desk with a ledger and a candle; low patched rug (rectangle); wooden stand with a few pinned notes (blank); stool with a cushion.
> Row 2 (Rest): bunk bed with a thin straw mattress and grey blanket; second bunk with a brown blanket; small plain wooden chest with a rope handle; single candle on an upturned crate.
> Row 3 (Dining): rough round table with a bowl and a mug; two mismatched stools (one object); small stone fireplace with a dim fire and a hanging pot; barrel of water with a ladle.
> Row 4 (Records, decor): crooked bookshelf with a few books; small potted weed-like plant in a clay pot; plain wall shield (round, wood); coat hooks board with a worn cloak.

### Rank 2 sheet (Established Hall)
> Row 1 (Reception): oak reception counter with a brass bell, ledger and quill pot; woven rug with a simple border; tall oak notice stand with a cork board (blank); cushioned wooden chair.
> Row 2 (Rest): neat bunk bed with white sheets and a blue blanket; second bunk with a red blanket; iron-banded oak chest; iron floor lamp with a warm flame.
> Row 3 (Dining): long oak dining table with plates, bread and mugs; pair of benches (one object); stone fireplace with a lit fire, mantel candles and a crossed-sword plaque; keg on a stand with a tap.
> Row 4 (Records, decor): full bookshelf with scrolls; lectern with an open book; leafy potted plant in a glazed pot; wall shield and crossed spears mount.

### Rank 3 sheet (Prosperous Hall)
> Row 1 (Reception): dark walnut reception desk with brass trim, bell, ledger and a small globe; large navy rug with gold fringe; tall brass-framed notice stand with a green felt board (blank); high-back leather chair.
> Row 2 (Rest): canopy-less four-poster bed with a quilted blue cover; second bed with a crimson cover; iron-and-wood treasure chest with a brass lock; brass candelabra with five candles.
> Row 3 (Dining): grand banquet table with a white cloth, roast, goblets and candles; four carved chairs (one object); large stone hearth with a carved mantel and a guild crest above; wine rack with bottles.
> Row 4 (Records, decor): tall library shelf with ladder; standing globe on a stand; large potted fern in a brass planter; suit of steel armour on a display stand.

### Rank 4 sheet (Grand Guildhall)
> Row 1 (Reception): marble reception desk with gold inlay, crystal inkwell, bell and ledger; crimson carpet piece with gold border (rectangle); gilded notice stand with a velvet board (blank); gold-trimmed throne-style chair.
> Row 2 (Rest): luxurious four-poster bed with silk curtains and gold tassels; second bed in royal blue silk; gilded treasure chest overflowing with a few coins; tall gold floor candelabra.
> Row 3 (Dining): immense banquet table with silver platters, fruit and goblets; ornate carved chair set (one object); marble fireplace with gilded mantel and a large guild crest and swords above; crystal chandelier (shown hanging, top-down friendly).
> Row 4 (Records, decor): double-height library shelf with brass ladder; large armillary sphere on a marble plinth; stone planter with a small ornamental tree; marble bust of a founder on a plinth.

## C. Suggested layout so it reads as one guild (same positions each rank, props swap by rank)
Tile coordinates on the 25 x 14 grid:
- **Reception (centre):** desk at x11-14, y6.5 facing the stairs side; rug under and in front (y7-9); notice stand at x9, y5.5; chair behind the desk.
- **Rest quarters (right, bottom):** two bunks at x19-22, y10.5; chest between the bunks at x21, y12.5; lamp at x23.3, y10.5. A wall of sleeping spots keeps fighters resting there.
- **Dining and social (centre-bottom):** table at x11.5-14.5, y10.5 with benches on each long side; hearth on the back wall at x16-18 is already the market door, so put the fireplace on the **left wall near x0.8, y6.5** or just right of the stairs (rank 3 and 4 only); keg or wine rack beside the table.
- **Records and study (left, upper):** bookshelf at x6.5-8, y4.5 and lectern at x7, y6.5; globe next to the map.
- **Decor:** plants in the corners (x0.9,y13 and x24,y13), shield and spear mount on the wall at x6.5-8.5, y1.8 between the trophy and the banner.
- Keep a 3-tile-wide open walkway from the stairs (x21, y5.9) down and across to the training yard.

## D. Carpenter (upgrades the guild look)
Standing near the Reception, bottom of the stairs side. Same sheet format as v4: row 1 six front idle frames, row 2 six frames facing right (I mirror for left), 1024 x 1024, magenta background, attach `public/npc/blacksmith.png` and `public/npc/gladiator.png`.

> 2D pixel-art character sheet in the style of the attached references: chunky JRPG proportions with a slightly oversized head, painted pixel shading, soft top-left light, dark plum outline, crisp hard pixel edges. **Two rows of 6 idle frames.** Row 1: facing the camera. Row 2: same character facing right in a 3/4 side view. Same size (about 150 px tall) and same baseline in every frame. Flat magenta (#FF00FF) background, no ground, no shadow, no text.
> **Character:** a lean, cheerful master carpenter in his fifties: weathered tan skin, short curly grey hair under a flat linen cap, a pencil behind his ear, grey-brown moustache and kind squinting eyes. Cream long-sleeved shirt with rolled sleeves, a leather tool apron with a folding ruler, chisels, a hand saw tucked through the belt and a nail pouch, brown work trousers with knee patches, sturdy boots with sawdust on them, a rolled blueprint scroll under his left arm, a small mallet in his right hand. A guild badge (gold shield) pinned on the apron. In the side row the saw, scroll and tool belt clearly show.
> **Frames:** 1 rest, mallet at his side; 2 lifts the scroll slightly and looks at it; 3 unrolls it a little, eyebrows up; 4 taps the mallet in his palm and nods, tiny sawdust puff (1 px); 5 pencil from the ear, taps his chin, thinking; 6 returns the pencil, settles (flows into frame 1).

### Carpenter extras (optional, 1 image)
> Small wooden **sawhorse with a plank and hand saw** and a **stack of lumber with a rope tie**, two objects on magenta, to place next to him as his stall. Rank-neutral oak look.

## E. Build notes
- Hall backgrounds import per rank as `public/guild/hall-r1.png` to `hall-r4.png`; props as `public/guild/props/r<N>_<id>.png`. The guild rank would be stored on the profile (`guild_rank` 1-4) and the carpenter would charge a fee per upgrade. I need rank costs and the rank-up conditions before building that.
