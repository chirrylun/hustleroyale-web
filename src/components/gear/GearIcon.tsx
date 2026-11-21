import { RANK_RING, kindGlyph } from "@/lib/gear";

/** Stand-in picture for a piece of gear (a glyph in a rank-coloured frame) until each item has its own art. */
export function GearIcon({ kind, rank, size = 40 }: { kind: string; rank: number; size?: number }) {
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center border-2 bg-night ${RANK_RING[rank] ?? ""}`} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {kindGlyph(kind)}
    </span>
  );
}
