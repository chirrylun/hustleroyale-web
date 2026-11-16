"""Cuts the monster-drop icons (public/items/<slug>.png, 128 px) out of the hand-drawn item sheet.

  python3 tools/build_items.py <item sheet png>

The sheet is 5 x 2 icons on a flat magenta background, read left to right, top row first. The background is
removed and each icon found with the same blob detection the skill icons use (see build_skills.py).
"""
import sys
from pathlib import Path

from build_skills import ROOT, icon_cells, save_icon

NAMES = [
    "slime_gel", "bat_wing", "spore_cap", "goblin_ear", "wolf_fang",
    "golem_shard", "marsh_cap", "frost_pelt", "golem_heart", "goblin_crown",
]


def main():
    out = ROOT / "public" / "items"
    out.mkdir(parents=True, exist_ok=True)
    for name, art in icon_cells(Path(sys.argv[1]), NAMES, cols=5, rows=2):
        save_icon(name, art, out)
        print("item", name)


if __name__ == "__main__":
    main()
