import { Buf, SIZE } from "./pixel";
import { ANIMS, COLS, drawFighter, pose } from "./draw";
import { designFor, type Role } from "./designs";

const cache = new Map<string, string>();
export const ROWS = ANIMS.length;

/** One PNG data-URL per fighter holding every animation (rows) and frame (columns). Built lazily, cached. */
export function sheetUrl(key: string, role: Role): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const d = designFor(key, role);
  const cv = document.createElement("canvas");
  cv.width = SIZE * COLS; cv.height = SIZE * ROWS;
  const ctx = cv.getContext("2d")!;
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = SIZE;
  const tctx = tmp.getContext("2d")!;
  ANIMS.forEach((a, row) => {
    for (let i = 0; i < a.n; i++) {
      const ox = i * SIZE, oy = row * SIZE;
      // crisp ground shadow (+ glowing ring for rare+)
      for (let y = 56; y < 64; y++)
        for (let x = 12; x < 52; x++) {
          const e = ((x + 0.5 - 32) / 15) ** 2 + ((y + 0.5 - 60) / 3.4) ** 2;
          if (e <= 1) { ctx.fillStyle = "rgba(0,0,0,.38)"; ctx.fillRect(ox + x, oy + y, 1, 1); }
          else if (d.tier >= 2 && e <= 1.5) { ctx.fillStyle = `#${d.glow.toString(16).padStart(6, "0")}99`; ctx.fillRect(ox + x, oy + y, 1, 1); }
        }
      const b = new Buf();
      const p = pose(a.name, i, a.n);
      drawFighter(b, d, p, i / a.n);
      tctx.putImageData(new ImageData(b.toRGBA(p.flash), SIZE, SIZE), 0, 0);
      ctx.drawImage(tmp, ox, oy);
    }
  });
  const url = cv.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
export { designFor };
