/** Tiny 8x8 pixel icons for the menu buttons. "#" is a filled pixel. */
const ICONS = {
  fight: ["#......#", ".#....#.", "..#..#..", "...##...", "..#..#..", ".#.##.#.", "##....##", "#......#"],
  fighters: ["..####..", ".######.", ".######.", "..####..", "...##...", ".######.", "########", "########"],
  market: ["..####..", ".######.", "###..###", "##.##.##", "##.##.##", "###..###", ".######.", "..####.."],
  training: ["........", "#......#", "##....##", "########", "########", "##....##", "#......#", "........"],
  leaderboard: ["########", "#.####.#", "#.####.#", ".######.", "..####..", "...##...", "..####..", ".######."],
  help: ["..####..", ".##..##.", "....##..", "...##...", "...##...", "........", "...##...", "...##..."],
  profile: ["...##...", "...##...", "########", ".######.", "..####..", ".##..##.", ".#....#.", "........"],
} as const;

export type IconName = keyof typeof ICONS;

export function PixelIcon({ name, className }: { name: IconName; className?: string }) {
  const rows = ICONS[name];
  return (
    <svg viewBox="0 0 8 8" shapeRendering="crispEdges" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      {rows.flatMap((row, y) =>
        [...row].map((c, x) => (c === "#" ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)),
      )}
    </svg>
  );
}
