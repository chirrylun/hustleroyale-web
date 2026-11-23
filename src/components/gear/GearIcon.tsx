import art from "@/lib/gearArt.json";
import { RANK_RING, kindGlyph } from "@/lib/gear";

const HAS = new Set<string>([...art.armor, ...art.weapons]);
/** Whether this item has its own picture yet (armour sets and the weapons that have been drawn). */
export const hasGearArt = (slug: string) => HAS.has(slug);

/** The item's own picture in a rank-coloured frame: the full armour set, or the weapon or shield itself. A glyph stands in until it is drawn. */
export function GearIcon({ slug, kind, rank, size = 40 }: { slug: string; kind: string; rank: number; size?: number }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center border-2 bg-night ${RANK_RING[rank] ?? ""}`} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {HAS.has(slug)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/gear/icons/${slug}.png`} alt="" width={size - 4} height={size - 4} className="[image-rendering:pixelated]" draggable={false} />
        : kindGlyph(kind)}
    </span>
  );
}
