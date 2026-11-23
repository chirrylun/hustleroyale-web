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
