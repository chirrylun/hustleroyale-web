import clsx from "clsx";
import type { Role } from "@/lib/starter-pack";

/**
 * Pixel-art fighters drawn from code, so every fighter has art without image files.
 * Each look is a small recipe: colours, a headgear style and a held item. The sprite is a
 * 24x24 grid of rectangles with a dark outline, and it stays crisp at any size.
 */

type Headgear = "short" | "cap" | "crown" | "gele" | "afro" | "hood" | "helmet" | "bald";
type Item = "shield" | "sword" | "staff" | "orb" | "bat" | "daggers";

interface Look {
  skin: string;
  hair: string;
  head: Headgear;
  headColor: string;
  body: string;
  trim: string;
  pants: string;
  item: Item;
  itemColor: string;
  accent: string;
  cross?: boolean;
}

const INK = "#1a1c2c";
const WHITE = "#f4f4f4";
const WOOD = "#6b4423";

const LOOKS: Record<string, Look> = {
  danfo_guard: { skin: "#8d5524", hair: INK, head: "helmet", headColor: "#94b0c2", body: "#f2c230", trim: INK, pants: "#29366f", item: "shield", itemColor: "#f2c230", accent: INK },
  herbal_hawker: { skin: "#c68642", hair: INK, head: "cap", headColor: "#38b764", body: "#38b764", trim: "#a7f070", pants: "#566c86", item: "staff", itemColor: "#a7f070", accent: "#a7f070", cross: true },
  street_scrapper: { skin: "#8d5524", hair: INK, head: "short", headColor: INK, body: "#b13e53", trim: INK, pants: "#333c57", item: "bat", itemColor: "#94b0c2", accent: "#ffcd75" },
  gen_mage: { skin: "#8d5524", hair: INK, head: "hood", headColor: "#41a6f6", body: "#41a6f6", trim: "#ffcd75", pants: "#29366f", item: "orb", itemColor: "#ffcd75", accent: "#ffcd75" },
  iron_iya: { skin: "#5a3a22", hair: INK, head: "gele", headColor: "#b13e53", body: "#ef7d57", trim: "#ffcd75", pants: "#566c86", item: "shield", itemColor: "#94b0c2", accent: "#ffcd75" },
  native_doctor: { skin: "#8d5524", hair: INK, head: "cap", headColor: "#b13e53", body: "#566c86", trim: "#ffcd75", pants: "#333c57", item: "staff", itemColor: "#ef7d57", accent: "#ffcd75", cross: true },
  molue_mauler: { skin: "#c68642", hair: INK, head: "helmet", headColor: "#b13e53", body: "#333c57", trim: "#ef7d57", pants: "#1a1c2c", item: "sword", itemColor: WHITE, accent: "#ef7d57" },
  oga_patapata: { skin: "#8d5524", hair: INK, head: "cap", headColor: "#b13e53", body: "#29366f", trim: "#ffcd75", pants: "#1a1c2c", item: "shield", itemColor: "#ffcd75", accent: "#29366f" },
  sister_grace: { skin: "#c68642", hair: INK, head: "gele", headColor: "#41a6f6", body: WHITE, trim: "#41a6f6", pants: "#94b0c2", item: "staff", itemColor: "#ffcd75", accent: "#41a6f6", cross: true },
  agbero_king: { skin: "#8d5524", hair: INK, head: "crown", headColor: "#ffcd75", body: "#b13e53", trim: "#ffcd75", pants: "#29366f", item: "shield", itemColor: "#ffcd75", accent: "#b13e53" },
  eko_shadow: { skin: "#8d5524", hair: INK, head: "hood", headColor: "#333c57", body: "#1a1c2c", trim: "#566c86", pants: "#1a1c2c", item: "daggers", itemColor: WHITE, accent: "#b13e53" },
  priestess_of_eko: { skin: "#5a3a22", hair: INK, head: "gele", headColor: "#ffcd75", body: WHITE, trim: "#ffcd75", pants: "#ffcd75", item: "staff", itemColor: "#73eff7", accent: "#ffcd75", cross: true },
};

/** Used if a fighter has no custom look yet (new templates still get a sensible sprite). */
const ROLE_FALLBACK: Record<Role, Look> = {
  tank: { ...LOOKS.danfo_guard! },
  healer: { ...LOOKS.herbal_hawker! },
  dps: { ...LOOKS.street_scrapper! },
};

interface Part {
  x: number;
  y: number;
  w: number;
  h: number;
  f: string;
  /** fill opacity */
  a?: number;
  /** false = no outline (shading, details) */
  o?: boolean;
}

function buildParts(l: Look): Part[] {
  const p: Part[] = [];
  const r = (x: number, y: number, w: number, h: number, f: string, extra: Partial<Part> = {}) => p.push({ x, y, w, h, f, ...extra });

  // Things behind the body.
  if (l.head === "afro") r(6, 0, 12, 8, l.hair);

  // Legs and shoes.
  r(8, 19, 3, 3, l.pants);
  r(13, 19, 3, 3, l.pants);
  r(7, 22, 4, 1, INK, { o: false });
  r(13, 22, 4, 1, INK, { o: false });

  // Torso, belt and shading.
  r(7, 11, 10, 8, l.body);
  r(7, 15, 10, 2, l.trim, { o: false });
  r(14, 11, 3, 8, "#000", { a: 0.18, o: false });
  if (l.cross) {
    const mark = l.body === WHITE ? l.trim : WHITE;
    r(11, 12, 2, 3, mark, { o: false });
    r(10, 13, 4, 1, mark, { o: false });
  }

  // Arms and hands.
  r(5, 12, 2, 6, l.body);
  r(17, 12, 2, 6, l.body);
  r(5, 18, 2, 2, l.skin);
  r(17, 18, 2, 2, l.skin);

  // Head and face.
  r(8, 3, 8, 8, l.skin);
  r(10, 6, 1, 2, INK, { o: false });
  r(13, 6, 1, 2, INK, { o: false });
  if (l.head !== "hood") r(11, 9, 2, 1, "#000", { a: 0.35, o: false });

  // Headgear.
  switch (l.head) {
    case "short":
      r(8, 2, 8, 3, l.hair);
      r(7, 3, 1, 4, l.hair);
      r(16, 3, 1, 4, l.hair);
      break;
    case "cap":
      r(7, 1, 10, 4, l.headColor);
      r(8, 5, 8, 1, l.trim === l.headColor ? INK : l.trim, { o: false });
      break;
    case "crown":
      r(8, 2, 8, 3, l.hair);
      r(8, 1, 8, 2, l.headColor);
      r(8, 0, 2, 1, l.headColor);
      r(11, 0, 2, 1, l.headColor);
      r(14, 0, 2, 1, l.headColor);
      break;
    case "gele":
      r(6, 1, 12, 4, l.headColor);
      r(14, 0, 5, 2, l.headColor);
      r(7, 3, 10, 1, WHITE, { a: 0.3, o: false });
      break;
    case "afro":
      r(8, 2, 8, 2, l.hair);
      break;
    case "hood":
      r(7, 1, 10, 3, l.headColor);
      r(7, 4, 2, 6, l.headColor);
      r(15, 4, 2, 6, l.headColor);
      r(9, 8, 6, 3, l.headColor);
      break;
    case "helmet":
      r(7, 1, 10, 4, l.headColor);
      r(11, 4, 2, 4, l.headColor);
      r(11, 0, 2, 1, l.accent);
      break;
    case "bald":
      break;
  }

  // Held item, drawn last so it sits in front.
  switch (l.item) {
    case "shield":
      r(1, 11, 7, 10, l.itemColor);
      r(3, 13, 3, 6, l.accent, { o: false });
      break;
    case "sword":
      r(20, 3, 2, 14, l.itemColor);
      r(18, 16, 6, 1, l.accent);
      r(20, 17, 2, 4, WOOD);
      break;
    case "staff":
      r(20, 4, 1, 18, WOOD);
      r(18, 1, 5, 4, l.itemColor);
      r(19, 2, 1, 1, WHITE, { o: false });
      break;
    case "orb":
      r(19, 9, 4, 4, l.itemColor);
      r(20, 10, 1, 1, WHITE, { o: false });
      r(18, 7, 1, 1, l.itemColor, { o: false });
      r(22, 14, 1, 1, l.itemColor, { o: false });
      break;
    case "bat":
      r(20, 11, 2, 9, WOOD);
      r(19, 3, 4, 9, l.itemColor);
      break;
    case "daggers":
      r(3, 12, 1, 6, l.itemColor);
      r(2, 18, 3, 1, l.accent);
      r(20, 12, 1, 6, l.itemColor);
      r(19, 18, 3, 1, l.accent);
      break;
  }
  return p;
}

export function FighterSprite({
  spriteKey,
  role,
  flip = false,
  className,
}: {
  spriteKey: string;
  role: Role;
  /** Face left instead of right (used for the rival team). */
  flip?: boolean;
  className?: string;
}) {
  const look = LOOKS[spriteKey] ?? ROLE_FALLBACK[role];
  const parts = buildParts(look);
  return (
    <svg
      viewBox="0 0 24 24"
      shapeRendering="crispEdges"
      className={clsx("block h-auto w-full", className)}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden="true"
      focusable="false"
    >
      {parts.map((s, i) =>
        s.o === false ? null : <rect key={`o${i}`} x={s.x - 1} y={s.y - 1} width={s.w + 2} height={s.h + 2} fill={INK} />,
      )}
      {parts.map((s, i) => (
        <rect key={`f${i}`} x={s.x} y={s.y} width={s.w} height={s.h} fill={s.f} fillOpacity={s.a} />
      ))}
    </svg>
  );
}
