"""Cuts the monster-drop icons (public/items/<slug>.png, 128 px) out of the hand-drawn item sheet.

  python3 tools/build_items.py <item sheet png>

The sheet is 5 x 2 icons on a flat magenta background, read left to right, top row first. The background is
removed and each icon found with the same blob detection the skill icons use (see build_skills.py).
"""
import sys
from pathlib import Path

from PIL import Image

from build_skills import ROOT, icon_cells, save_icon

NAMES = [
    "slime_gel", "bat_wing", "spore_cap", "goblin_ear", "wolf_fang",
    "golem_shard", "marsh_cap", "frost_pelt", "golem_heart", "goblin_crown",
]


POTION_NAMES = [
    "hp_potion", "hp_potion_m", "hp_potion_l", "hp_potion_max", "revive_potion",
    "mp_potion", "mp_potion_m", "mp_potion_l", "mp_potion_max", "teleport_stone",
]


def main():
    """  python3 tools/build_items.py <drops sheet png>            monster drops (5 x 2)
      python3 tools/build_items.py --potions <potions sheet png>  potions, revive potion, teleport stone (5 x 2)
    Either way the list of available art (src/lib/item-art.json) is rebuilt."""
    import json
    out = ROOT / "public" / "items"
    out.mkdir(parents=True, exist_ok=True)
    if sys.argv[1] == "--potions":
        cells = icon_cells(Path(sys.argv[2]), POTION_NAMES, cols=5, rows=2)
    else:
        cells = icon_cells(Path(sys.argv[1]), NAMES, cols=5, rows=2)
    # Potions keep their relative sizes (S < M < L < Max), softened so the small ones stay readable at 40 px.
    cells = list(cells)
    big = max(max(a.size) for _, a in cells)
    for name, art in cells:
        if sys.argv[1] == "--potions":
            k = 112 * (max(art.size) / big) ** 0.5 / max(art.size)  # the biggest icon fills 112 px of the 128 tile
            art = art.resize((max(1, round(art.width * k)), max(1, round(art.height * k))), Image.NEAREST)
            save_icon(name, art, out, fit=False)
        else:
            save_icon(name, art, out)
        print("item", name)
    names = sorted(p.stem for p in out.glob("*.png"))
    (ROOT / "src" / "lib" / "item-art.json").write_text(json.dumps(names, indent=1) + "\n")


if __name__ == "__main__":
    main()
