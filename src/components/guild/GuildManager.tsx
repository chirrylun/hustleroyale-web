/** The guild manager, who talks the player through the tutorial: shown as a still idle pose (first frame of his sprite strip). */
const FRAME_W = 304, FRAME_H = 322;

export function GuildManager({ height = 150 }: { height?: number }) {
  const w = Math.round((FRAME_W / FRAME_H) * height);
  return (
    <div
      role="img"
      aria-label="The guild manager"
      className="shrink-0"
      style={{ width: w, height, backgroundImage: "url(/npc/manager.png)", backgroundSize: `${w * 6}px ${height}px`, backgroundPosition: "0 0", backgroundRepeat: "no-repeat", imageRendering: "pixelated" }}
    />
  );
}
