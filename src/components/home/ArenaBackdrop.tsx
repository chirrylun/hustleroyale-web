/** Pixel-art dungeon floor (public/arena/dungeon.png, 240x120) scaled up crisply to fill the arena. */
export function ArenaBackdrop() {
  return (
    <div
      className="absolute inset-0"
      style={{ backgroundImage: "url(/arena/dungeon.png)", backgroundSize: "100% 100%", imageRendering: "pixelated" }}
      aria-hidden="true"
    />
  );
}
