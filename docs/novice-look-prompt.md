# Novice base look (the "nothing equipped" sprite)

Every fighter is a novice body; armour changes the look, weapons are added later. This is the plain base that shows with **no armour and no weapon**. Armour sets, weapons and the previews are all made against it, so approve it first.

Make **two** sheets, male then female (attach the approved male when making the female so the grid matches). Attach the current `public/sprites/novice_male.png` / `novice_female.png` as the grid reference.

> 2D pixel-art **character sprite sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the current novice sheet: **1248 x 1248 px, 6 x 6 grid of 208 px cells**, rows = idle (4 frames), walk (6), attack (5), cast (5), hurt (2), windup (2). **Redraw the same sheet as a plain, unequipped novice**: the same face, hair colour and style, skin tone and build; **head top at y = 66, feet baseline at y = 187, body centre x = 104, body height 122 px** in every frame, and the same leg and arm motion in every frame.
>
> Outfit: a **short-sleeved off-white linen undershirt**, **simple brown cloth shorts to the knee**, **bare feet**. No hat, hood, armour, gloves, belt, pouches, scarf or jewellery. **Hands empty and slightly curled** where they would hold something; the attack, cast and windup rows keep the same swing and casting arm motion with an empty hand (a plain punch / open-palm cast), **no slash trails, no glow, no magic effects, no weapon, no shield**.
>
> Flat **magenta #FF00FF** background, crisp hard pixel edges, **no anti-aliasing**, 1 px dark outline, limited palette (about 12 colours), no shadow, no ground, no text, nothing outside its cell.

**Checks before sending:** every frame's feet sit on y = 187; the head does not bob more than 2 px in idle; shirt and shorts stay within 3 px of the body outline (armour is drawn over this, so keep it slim); magenta fully removed when imported.

**Save as** `public/sprites/novice_male.png` and `public/sprites/novice_female.png` (replacing the current ones), and also keep copies in `public/sprites/bare/`. Once they arrive I will make this the default look for novices and for any fighter with no armour equipped; weapons come in with the weapon sheets afterwards.

---

## Starter armour (novice, rank 1 only)

Novices get one set, **rank 1, enhanceable to level 10, no evolving**. It is worn over the bare novice above, so only the clothing changes. Make male, then female (attach the matching approved bare sheet each time).

> 2D pixel-art **character sprite sheet** in the style of Chained Echoes and 16-bit JRPGs. Attached is the plain novice sheet (**1248 x 1248 px canvas, 208 px cells, same frames and rows as attached**). **Redraw exactly the same sheet, the same character, wearing a simple beginner's adventurer set** and nothing else new. Keep **pixel-identical**: every pose and frame count, the **head size and position (head top y = 66)**, **feet baseline y = 187**, body centre x = 104, body height 122 px, the face, hair, skin tone, and the arm and leg motion of each frame, **including the same empty fists** (no weapon, no shield, no glow, no slash trails).
>
> The set: a **quilted tan-and-brown leather jerkin** over the same off-white undershirt (short sleeves still showing at the arms), a **plain brown leather belt** with a small buckle, **leather forearm wraps**, **simple brown cloth trousers kept to the knee** with **low brown leather boots** (this replaces the bare feet), and **no helmet, hood or cape**. Humble and slightly worn, clearly "first gear": one colour family (warm browns and tan, a single muted red-brown stitch accent), about 14 colours.
>
> The armour **hugs the body outline**: at most 3 px of bulk on any limb and 5 px at the shoulders, and nothing hangs more than 6 px outside the base silhouette. Flat **magenta #FF00FF** background, crisp hard pixel edges, **no anti-aliasing**, 1 px dark outline, no shadow, no ground, no text.

**Save as** `armor_novice_1_male.png` and `armor_novice_1_female.png` (the pipeline builds `armor_novice_1.png` and the shop/inventory icon from them). One rank only, so there is no rank 2-4 art for this set. Levels 1-10 change the stats, not the look.
