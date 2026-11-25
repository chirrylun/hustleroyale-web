# New mobs (5) and minibosses (3)

Each mob is one sheet per tier (common, uncommon, rare), like the existing mobs. Minibosses get a single sheet. Make the common tier first, then attach it to get uncommon and rare so the design stays the same.

## Master prompt

> 2D pixel-art **monster sprite sheet** in the style of Chained Echoes and 16-bit JRPGs, **2048 x 2048 px** on flat **magenta #FF00FF**, rows top to bottom: **idle (5 frames), walk (6), attack (5), cast (5), hurt (2), windup (2)**, one frame per slot, evenly spaced, nothing touching, the creature **facing right**, **feet or underside on one baseline per row**, same size in every frame (SIZE below).
> The walk row is a **real cycle** (legs or body clearly moving, a small bob, weight shifting), the attack row has a clear **windup, strike and recover**, the cast row is a short **roar / rear-up / glow** with no projectile, hurt is a flinch, windup is a gathering pose. Idle is a gentle 5-frame loop (breathing, bobbing).
> Crisp hard pixel edges, no anti-aliasing, 1 px dark outline, limited palette (about 14 colours), no shadow, no ground, no text, no effects outside the creature's silhouette.

## Mobs (SIZE: about 200 px at its tallest, same scale as the slime and goblin)

- **Thornback Boar** (Meadows and Marsh). A stocky wild boar with a ridge of thorny brambles and green leaves along its back, short curved cream tusks, small angry red-brown eyes, mossy brown-grey hide, cloven hooves. Attack: head-down charge and upward tusk gore. Cast: stamps and snorts. Tiers: common (brown, green thorns), uncommon (darker hide, red thorn tips, longer tusks), rare (near-black hide, glowing amber eyes, iron-grey thorns).
- **Cave Weaver** (Hollow Depths). A big spider about knee height, round dark-purple abdomen with a pale hourglass mark, eight jointed legs, four glowing yellow eyes, small curved fangs, a few strands of web trailing. Attack: front-leg stab and bite. Cast: rears up on four back legs. Tiers: common (purple-black), uncommon (teal carapace stripes), rare (bone-white carapace, red eyes, glowing crimson hourglass).
- **Bog Lurker** (Marsh). A hunched amphibian brute, wide mouth, bulging yellow eyes, slick olive skin with dark warts, long webbed hands that drag near the ground, reeds and mud clinging to its back. Attack: heavy two-handed slam. Cast: inflates its throat. Tiers: common (olive), uncommon (swamp green with orange belly), rare (blue-green with glowing violet spots).
- **Frost Wisp** (Frostbite Reach). A floating spirit of pale blue flame in a wispy hooded shape, two glowing white eyes, a tail that fades into snow, tiny orbiting ice shards, no legs (floats, bobs). Attack: lunges forward in a spinning streak. Cast: flares and spreads its arms. Walk is a gliding drift with the tail swaying. Tiers: common (pale blue), uncommon (cyan with white core), rare (deep blue with violet core and larger shards).
- **Stone Beetle** (Hollow Depths and Frostbite Reach). A fat armoured beetle, rounded grey stone shell with cracks and small crystals on it, six stubby legs, small curved horn, glowing orange eyes. Attack: rams forward with the horn. Cast: lifts its shell slightly and glows through the cracks. Tiers: common (grey stone), uncommon (mossy green crystals), rare (obsidian shell with glowing ember cracks).

## Minibosses (SIZE: about 300 px tall, one sheet each, a crown or mark so they read as special)

- **Slime King** (Meadows and Marsh). A huge translucent green slime shaped like a rounded throne, a small gold crown floating on top, a few swallowed coins, a skull and a sword blade suspended inside, a smug heavy-lidded face. Walk is a squash-and-slide. Attack: slams down and splashes outward. Cast: swells up and wobbles. Hurt: splits and jiggles.
- **Broodmother** (Hollow Depths). A giant armoured spider with a swollen purple-black abdomen carrying glowing egg sacs, six red eyes in two rows, long barbed legs, a bone-white crest on the head, web draped over the legs. Walk is slow and heavy with the abdomen swaying. Attack: double leg stab and bite. Cast: rears up showing the underside.
- **Rimewarden** (Frostbite Reach). A hulking ice knight: jagged ice-blue plate with frost on the edges, a tall horned helm with two glowing white eye slits, a long torn pale-blue cloak, huge gauntlets of ice, empty hands (no weapon). Walk is a slow stomping march with the cloak trailing. Attack: two-handed overhead smash. Cast: slams a fist down and breathes frost.

Save as `public/sprites/mob_<name>_<tier>.png` (e.g. `mob_boar_common.png`) and `mob_<name>_mini.png` for the minibosses; the converter does the sizing.

## How the minibosses will work (when you are ready for me to build it)

A miniboss appears on its floor at a random time (about 3 to 8 minutes after the floor opens), is announced to the room, has about 3 times a boss's attack and 4 times a normal mob's HP at floor level + 3, drops a rare item, and pays like half a boss. After it dies it cools down (about 15 minutes per player's floor) before it can appear again. Special hunt quests ask you to defeat it once.
