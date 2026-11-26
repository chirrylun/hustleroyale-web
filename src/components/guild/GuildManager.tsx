/** The guild manager, who talks the player through the tutorial: a 6-frame idle loop (leaning on his mace, gesturing as he explains). */
const FRAME_W = 304, FRAME_H = 322;

export function GuildManager({ height = 150 }: { height?: number }) {
  const w = Math.round((FRAME_W / FRAME_H) * height);
  return (
    <div
      role="img"
      aria-label="The guild manager"
      className="manager-idle shrink-0"
      style={{ width: w, height, backgroundImage: "url(/npc/manager.png)", backgroundSize: `${w * 6}px ${height}px`, imageRendering: "pixelated", ["--fw" as string]: `${w}px` }}
    />
  );
}
