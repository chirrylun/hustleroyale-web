import npcs from "./npcs.json";

export type NpcName = keyof typeof npcs;
export type Facing = "front" | "left" | "right";

/**
 * An NPC's idle loop. The sheet is 6 frames across and one row per facing (front, left, right; the manager only has front).
 * It fills whatever width it is given, and the height follows from the sheet's proportions, so it scales with its parent.
 */
export function Npc({ name, facing = "front", className = "", style }: { name: NpcName; facing?: Facing; className?: string; style?: React.CSSProperties }) {
  const d = npcs[name];
  const row = d.rows === 1 ? 0 : facing === "left" ? 1 : facing === "right" ? 2 : 0;
  return (
    <div
      aria-hidden="true"
      className={`npc-pct ${className}`}
      style={{
        aspectRatio: `${d.w} / ${d.h}`,
        backgroundImage: `url(/npc/${name}.png)`,
        backgroundSize: `600% ${d.rows * 100}%`,
        backgroundPositionY: d.rows > 1 ? `${(row / (d.rows - 1)) * 100}%` : "0%",
        imageRendering: "pixelated",
        ...style,
      }}
    />
  );
}

/** Width/height of one frame, to size an NPC from how tall it should stand. */
export const npcRatio = (name: NpcName) => npcs[name].w / npcs[name].h;
