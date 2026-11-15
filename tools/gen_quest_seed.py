"""
Builds the quest ladder (one kill quest and one fetch quest per floor, each pair unlocking the next floor)
from the floors the game actually generates, so every quest is achievable.

  tsx tools/dump_floor_stats.ts > floorstats.json
  python3 tools/gen_quest_seed.py floorstats.json > quests_seed.sql

Floors are seeded by their number, so the mob mix of a floor never changes between visits. If you change
generateFloor() or the mob lists, regenerate and ship the new seed as a migration.
"""
import json, sys

d = {int(k): v for k, v in json.load(open(sys.argv[1])).items()}
xp_req = lambda L: 30 + 22 * L + 4 * L * L
ITEM = {"slime": "slime_gel", "bat": "bat_wing", "mushroom": "spore_cap", "goblin": "goblin_ear", "golem": "golem_shard", "direwolf": "wolf_fang"}
ITEM_NAME = {"slime_gel": "Slime Gel", "bat_wing": "Bat Wing", "spore_cap": "Spore Cap", "goblin_ear": "Goblin Ear", "golem_shard": "Golem Shard", "wolf_fang": "Wolf Fang"}
ITEM_PLURAL = {"slime_gel": "Slime Gel", "bat_wing": "Bat Wings", "spore_cap": "Spore Caps", "goblin_ear": "Goblin Ears", "golem_shard": "Golem Shards", "wolf_fang": "Wolf Fangs"}
PLURAL = {"slime": "slimes", "bat": "bats", "mushroom": "mushrooms", "goblin": "goblins", "golem": "golems", "direwolf": "direwolves"}
BOSS_NAME = {"goblin": "the Goblin Chief", "golem": "the Stone Colossus", "mushroom": "the Marsh King", "direwolf": "the Frost Alpha"}
BOSS_TITLE = {"goblin": "The Goblin Chief", "golem": "The Stone Colossus", "mushroom": "The Marsh King", "direwolf": "The Frost Alpha"}
DROP_CHANCE = 0.5
q = lambda s: "'" + s.replace("'", "''") + "'"

rows = []
for f in range(1, 40):
    s = d[f]
    top = sorted(s["kinds"].items(), key=lambda kv: (-kv[1], kv[0]))
    kk, kc = top[0]
    fk, fc = top[1] if len(top) > 1 and top[1][1] >= 2 else top[0]
    boss = s["boss"]
    kill_qty = 1 if boss else max(2, min(2 + ((f - 1) % 10) // 2, kc))
    fetch_qty = max(2, min(8, round(fc * 1.0)))
    xp = round(0.2 * xp_req(f))
    if boss:
        b = s["bossKind"]
        rows.append((f"kill-{f:02d}", f"Slay {BOSS_NAME[b]}", f"{BOSS_TITLE[b]} holds the way to Floor {f + 1}. Defeat it on Floor {f}.", "kill", f, f + 1, b, True, None, 1, 60 + 16 * f, round(xp * 1.5), f * 2))
    else:
        rows.append((f"kill-{f:02d}", f"Cull the {PLURAL[kk]}", f"Defeat {kill_qty} {PLURAL[kk]} on Floor {f}.", "kill", f, f + 1, kk, False, None, kill_qty, 30 + 8 * f, xp, f * 2))
    it = ITEM[fk]
    what = ITEM_NAME[it] if fetch_qty == 1 else ITEM_PLURAL[it]
    rows.append((f"fetch-{f:02d}", f"Gather {ITEM_PLURAL[it]}", f"Bring back {fetch_qty} {what} from the monsters of Floor {f}.", "fetch", f, f + 1, None, False, it, fetch_qty, 40 + 10 * f, xp, f * 2 + 1))

print("insert into public.quests (slug, title, blurb, kind, floor, unlocks_floor, target_kind, target_boss, item_slug, qty, reward_coins, reward_xp, sort) values")
out = []
for r in rows:
    slug, title, blurb, kind, fl, unl, tk, tb, item, qty, coins, xp, sort = r
    out.append(f"  ({q(slug)}, {q(title)}, {q(blurb)}, {q(kind)}, {fl}, {unl}, {q(tk) if tk else 'null'}, {'true' if tb else 'false'}, {q(item) if item else 'null'}, {qty}, {coins}, {xp}, {sort})")
print(",\n".join(out) + ";")
