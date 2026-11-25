"""Gear art for the shop, the equipment screen and the preview.

  python3 tools/build_gear_art.py --armor <dir with class folders> [--armor <another dir>] [--overlays]

--armor DIR   full-body armour sheets (one folder per class, rookie/soldier/knight/runed inside). Each is normalised like every other
              class sheet into public/sprites/armor_<class>_<rank>.png (the item slug is the sprite key), and its first idle frame
              becomes the shop picture public/gear/icons/armor_<class>_<rank>.png. Later --armor dirs win over earlier ones.
--overlays    weapon / shield overlay sheets already in public/gear/<male|female>/ -> a transparent copy for the preview
              (public/gear/preview/<slug>_<gender>.png) and a shop picture of the item itself (public/gear/icons/<slug>.png).
Writes src/lib/gearArt.json listing what exists, so the screens never ask for a picture that is not there.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from build_sprites import character, cut_background  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# Folder name -> gear class id, per zip (a later zip replaces an earlier one). The very first zip's "rogue" is the Thief look.
SAME = {"battlemedic": "battle_medic", "darkmage": "blackmage", "fightertank": "fighter", "mage": "mage", "marksman": "marksman", "necromancer": "necromancer",
        "ninja": "ninja", "paladin": "paladin", "purehealer": "pure_healer", "rogue": "rogue", "samurai": "samurai", "shieldtank": "shield_tank",
        "sharpshooter": "sharpshooter", "soldier": "soldier", "warden": "warden", "whitemage": "whitemage", "healer": "healer", "bard": "bard", "ranger": "ranger"}
FOLDERS = {
    "armor": {**SAME, "rogue": "thief", "tank": "warrior"},
    "new": {**SAME, "rogue": "thief"},   # the second zip, its "rogue" repeats the Thief look
    "all": SAME,                          # every later zip: "rogue" is the Rogue
}
CELL = 208
ICON = 96


def rank_of(name: str):
    n = name.lower()
    d = [c for c in n if c.isdigit()]
    if d and "rank" in n:
        return int(d[0]) if d[0] in "1234" else None
    return 1 if "rook" in n else 2 if "soldier" in n else 3 if "knight" in n else 4 if "rune" in n else None


def icon_from(rgba: np.ndarray, dst: Path):
    ys, xs = np.where(rgba[..., 3] > 40)
    if not len(ys):
        return False
    crop = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1])
    s = (ICON - 8) / max(crop.size)
    crop = crop.resize((max(1, round(crop.width * s)), max(1, round(crop.height * s))), Image.NEAREST)
    tile = Image.new("RGBA", (ICON, ICON), (0, 0, 0, 0))
    tile.alpha_composite(crop, ((ICON - crop.width) // 2, (ICON - crop.height) // 2))
    dst.parent.mkdir(parents=True, exist_ok=True)
    tile.save(dst, optimize=True)
    return True


def armour(dirs):
    found = {}
    for d in dirs:
        d = Path(d)
        maps = FOLDERS["armor" if d.name == "armor" else "new" if (d.name == "new" and d.parent.name == "new") else "all"]
        for folder, cls in maps.items():
            for f in sorted((d / folder).glob("*")) if (d / folder).is_dir() else []:
                if f.suffix.lower() not in (".jpg", ".jpeg", ".png"):
                    continue
                r = rank_of(f.stem)
                if r and (f"{cls}_{r}" not in found or f.suffix.lower() == ".png"):
                    found[f"{cls}_{r}"] = f
    out = ROOT / "public" / "sprites"
    done = []
    for key, src in sorted(found.items()):
        slug = f"armor_{key}"
        dst = out / f"{slug}.png"
        print(slug, "<-", src)
        character(str(src), str(dst), slug, six=True)
        sheet = np.asarray(Image.open(dst).convert("RGBA"))
        if icon_from(sheet[0:CELL, 0:CELL], ROOT / "public" / "gear" / "icons" / f"{slug}.png"):
            done.append(slug)
    return done


def kind_rank(stem: str):
    parts = stem.split("_")
    kind = parts[-2]
    return ("staff" if kind == "longstaff" else kind), parts[-1]


def overlays():
    done = []
    for g in ("male", "female"):
        for f in sorted((ROOT / "public" / "gear" / g).glob("*.png")):
            kind, rank = kind_rank(f.stem)
            slug = f"{kind}_{rank}"
            rgba = cut_background(str(f), strict=True)
            dst = ROOT / "public" / "gear" / "preview" / f"{slug}_{g}.png"
            dst.parent.mkdir(parents=True, exist_ok=True)
            Image.fromarray(rgba).save(dst, optimize=True)
            if g == "male":
                # the item alone, from the attack row's first frame where it is held out and fully visible
                icon_from(rgba[2 * CELL:3 * CELL, 0:CELL], ROOT / "public" / "gear" / "icons" / f"{slug}.png")
                done.append(slug)
    return done


def main():
    a = sys.argv[1:]
    dirs = [a[i + 1] for i, x in enumerate(a) if x == "--armor"]
    art = ROOT / "src" / "lib" / "gearArt.json"
    cur = json.loads(art.read_text()) if art.exists() else {"armor": [], "weapons": []}
    if dirs:
        cur["armor"] = sorted(set(cur["armor"]) | set(armour(dirs)))
    if "--overlays" in a:
        cur["weapons"] = sorted(set(cur["weapons"]) | set(overlays()))
    art.write_text(json.dumps(cur, indent=1) + "\n")
    print("armour sets:", len(cur["armor"]), "weapons:", cur["weapons"])


if __name__ == "__main__":
    main()
