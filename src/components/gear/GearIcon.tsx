import art from "@/lib/gearArt.json";
import { RANK_RING, artSlug, kindGlyph } from "@/lib/gear";

const HAS = new Set<string>([...art.armor, ...art.weapons]);
/** Whether this base has its own picture at this rank yet (armour sets, and the weapons that have been drawn). */
export const hasGearArt = (baseSlug: string, rank: number) => HAS.has(artSlug(baseSlug, rank));

/** The piece's own picture in a rank-coloured frame. A glyph stands in until it is drawn. */
export function GearIcon({ base, kind, rank, size = 40 }: { base: string; kind: string; rank: number; size?: number }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center border-2 bg-night ${RANK_RING[rank] ?? ""}`} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {hasGearArt(base, rank)
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={`/gear/icons/${artSlug(base, rank)}.png`} alt="" width={size - 4} height={size - 4} className="[image-rendering:pixelated]" draggable={false} />
        : kindGlyph(kind)}
    </span>
  );
}
