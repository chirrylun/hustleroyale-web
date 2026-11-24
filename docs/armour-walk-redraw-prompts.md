# Armour sets that still have a stiff walk (redraw the sheets with a real walk row)

Five armour classes are left whose walk row is the idle pose repeated: **Fighter, Thief, Healer, Bard, Ranger** (4 ranks each = 20 sheets). The other 17 classes and the Starter Armor are done.
Make each rank as its own sheet. Attach the current sheet (`public/sprites/armor_<class>_<rank>.png`) and, as the motion reference, the approved `armor_rogue_2` sheet.

## Prompt (one per class and rank; fill in the look from the table)

> 2D pixel-art **character sprite sheet** in the style of Chained Echoes and 16-bit JRPGs, **2048 x 2048 px** on flat **magenta #FF00FF**, rows top to bottom: **idle (5 frames), walk (6), attack (5), cast (5), hurt (2), windup (2)**, one frame per slot, evenly spaced, nothing touching.
> **Keep exactly** the attached sheet's character, face, hair and the armour set described below: same colours, same silhouette, same size (**about 280 px head to feet in every frame, feet on one baseline per row**), idle, attack, cast, hurt and windup rows unchanged.
> **Redraw only the walk row as a real six-frame walk cycle** like the attached rogue sheet: contact, passing, contact on each leg, **legs clearly apart on the contact frames (about 70 px between the feet) and together on the passing frames**, **opposite arm swings with the legs**, a **small 4-6 px body bob** (lowest on contact, highest on passing), capes, scarves, plumes and hair lagging one frame behind. The character faces right in the walk row. No weapon, no shield, empty hands, no effects.
> Crisp hard pixel edges, no anti-aliasing, 1 px dark outline, no shadow, no ground, no text.

## The looks (what the current idle shows)

| Class | Rank 1 | Rank 2 | Rank 3 | Rank 4 |
|---|---|---|---|---|
| Fighter | brown leather jerkin, bandana | steel kettle helm, chainmail, red sash | steel helm with red plume, red sash | dark blue plate, gold-visor helm |
| Thief | tan hooded leathers | olive hooded leathers, red scarf | dark leathers, feathered cap | dark blue hooded leathers |
| Healer | cream robe, spiky brown hair | white and light-blue robe | white robe with crimson trim | navy robe with gold trim |
| Bard | brown cap and tunic | grey-brown tunic, feathered cap | maroon coat, cap with white plume | navy cloak, feathered cap |
| Ranger | green-brown hooded cloak | grey hooded cloak | green hat with feather, red cloak | dark blue cloak, hood |

Save as `armor_<class>_<rank>.png` (e.g. `armor_thief_3.png`). Everything else is automatic (size, icon, motion check).
