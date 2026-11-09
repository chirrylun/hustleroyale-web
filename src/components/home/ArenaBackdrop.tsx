/** Night-time city arena painted with plain rectangles, so it matches the pixel sprites. */
const BUILDINGS: [number, number, number][] = [
  [0, 20, 14], [14, 30, 10], [24, 16, 12], [36, 34, 9], [45, 22, 13], [58, 28, 10], [68, 18, 12],
  [80, 32, 9], [89, 24, 12], [101, 30, 10], [111, 17, 13], [124, 26, 9], [133, 34, 11], [144, 21, 16],
];
const STARS: [number, number][] = [[6, 5], [22, 11], [38, 4], [55, 9], [72, 6], [90, 12], [108, 5], [126, 10], [148, 6], [30, 18], [96, 17]];

export function ArenaBackdrop() {
  const horizon = 52;
  return (
    <svg
      viewBox="0 0 160 90"
      preserveAspectRatio="xMidYMid slice"
      shapeRendering="crispEdges"
      className="absolute inset-0 h-full w-full"
      aria-hidden="true"
      focusable="false"
    >
      {/* Sky bands */}
      <rect width="160" height="90" fill="#1a1c2c" />
      <rect y="12" width="160" height="12" fill="#29366f" />
      <rect y="24" width="160" height="12" fill="#3b4a8a" />
      <rect y="36" width="160" height="16" fill="#566c86" />
      {STARS.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#f4f4f4" />
      ))}
      <rect x="132" y="15" width="8" height="8" fill="#ffcd75" />
      <rect x="135" y="15" width="5" height="8" fill="#f4e3a8" />

      {/* Skyline with lit windows */}
      {BUILDINGS.map(([x, h, w]) => (
        <g key={x}>
          <rect x={x} y={horizon - h} width={w} height={h} fill="#1a1c2c" />
          {Array.from({ length: Math.floor(h / 6) }).map((_, row) =>
            Array.from({ length: Math.floor((w - 2) / 3) }).map((__, col) =>
              (x + row * 7 + col * 3) % 4 === 0 ? (
                <rect key={`${row}-${col}`} x={x + 2 + col * 3} y={horizon - h + 3 + row * 6} width="1" height="2" fill="#ffcd75" />
              ) : null,
            ),
          )}
        </g>
      ))}

      {/* Ground: checkered street */}
      <rect y={horizon} width="160" height="38" fill="#333c57" />
      {Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 20 }).map((__, col) =>
          (row + col) % 2 === 0 ? (
            <rect key={`${row}-${col}`} x={col * 8} y={horizon + 2 + row * 6} width="8" height="6" fill="#3b4565" />
          ) : null,
        ),
      )}
      <rect y={horizon} width="160" height="2" fill="#94b0c2" />
      {/* Middle line */}
      <rect x="79" y={horizon + 2} width="2" height="36" fill="#f4f4f4" opacity="0.25" />
    </svg>
  );
}
