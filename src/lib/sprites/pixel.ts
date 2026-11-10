export const SIZE = 64;
type N = number;
const ch = (c: N, s: N) => (c >> s) & 255;
export const mix = (a: N, b: N, t: N) => {
  const f = (s: N) => Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * t);
  return (f(16) << 16) | (f(8) << 8) | f(0);
};
export const light = (c: N, t: N) => mix(c, 0xfff4dc, t);
export const dark = (c: N, t: N) => mix(c, 0x1b1030, t);
const OUT = 0x1a1c2c;

interface Part { c: N; back: boolean; y0: N; y1: N }

/** Pixel layer buffer: parts get auto highlight/shade/outline; raw + fx layers are drawn flat. */
export class Buf {
  pid = new Int16Array(SIZE * SIZE).fill(-1);
  raw = new Int32Array(SIZE * SIZE).fill(-1);
  fx = new Int32Array(SIZE * SIZE).fill(-1);
  parts: Part[] = [];
  cur = -1;
  part(c: N, back = false) {
    this.parts.push({ c, back, y0: 99, y1: -1 });
    this.cur = this.parts.length - 1;
    return this;
  }
  private put(x: N, y: N) {
    if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
    const i = y * SIZE + x;
    this.pid[i] = this.cur;
    this.raw[i] = -1;
    const p = this.parts[this.cur];
    if (y < p.y0) p.y0 = y;
    if (y > p.y1) p.y1 = y;
  }
  ell(cx: N, cy: N, rx: N, ry: N) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) this.put(x, y);
    return this;
  }
  rect(x: N, y: N, w: N, h: N) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.put(Math.round(x) + i, Math.round(y) + j);
    return this;
  }
  cap(x1: N, y1: N, x2: N, y2: N, r: N) {
    const dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy || 1;
    for (let y = Math.floor(Math.min(y1, y2) - r); y <= Math.ceil(Math.max(y1, y2) + r); y++)
      for (let x = Math.floor(Math.min(x1, x2) - r); x <= Math.ceil(Math.max(x1, x2) + r); x++) {
        const t = Math.max(0, Math.min(1, ((x + 0.5 - x1) * dx + (y + 0.5 - y1) * dy) / l2));
        if ((x + 0.5 - x1 - dx * t) ** 2 + (y + 0.5 - y1 - dy * t) ** 2 <= r * r) this.put(x, y);
      }
    return this;
  }
  poly(pts: [N, N][]) {
    const ys = pts.map((p) => p[1]), xs = pts.map((p) => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if (yi > y + 0.5 !== yj > y + 0.5 && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.put(x, y);
      }
    return this;
  }
  px(x: N, y: N, c: N) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.raw[y * SIZE + x] = c;
  }
  fxp(x: N, y: N, c: N) {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) this.fx[y * SIZE + x] = c;
  }
  /** Shaded, outlined RGBA pixels. `flash` washes the body white (hit frame). */
  toRGBA(flash = false) {
    const n = SIZE * SIZE, out = new Int32Array(n).fill(-1);
    const same = (i: N, x: N, y: N) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && this.pid[y * SIZE + x] === this.pid[i];
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        if (this.raw[i] >= 0) { out[i] = this.raw[i]; continue; }
        const pi = this.pid[i];
        if (pi < 0) continue;
        const p = this.parts[pi];
        let c = p.back ? dark(p.c, 0.32) : p.c;
        if (!same(i, x, y - 1)) c = light(c, 0.34);
        else if (!same(i, x - 1, y)) c = light(c, 0.14);
        if (!same(i, x, y + 1) || !same(i, x + 1, y)) c = dark(c, 0.3);
        else if (y > p.y0 + (p.y1 - p.y0) * 0.64) c = dark(c, 0.14);
        out[i] = c;
      }
    const res = out.slice();
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const i = y * SIZE + x;
        if (out[i] >= 0) continue;
        if ((x > 0 && out[i - 1] >= 0) || (x < SIZE - 1 && out[i + 1] >= 0) || (y > 0 && out[i - SIZE] >= 0) || (y < SIZE - 1 && out[i + SIZE] >= 0)) res[i] = OUT;
      }
    const img = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) {
      let c = this.fx[i] >= 0 ? this.fx[i] : res[i];
      if (c < 0) continue;
      if (flash && this.fx[i] < 0 && c !== OUT) c = mix(c, 0xffffff, 0.7);
      img[i * 4] = ch(c, 16); img[i * 4 + 1] = ch(c, 8); img[i * 4 + 2] = ch(c, 0); img[i * 4 + 3] = 255;
    }
    return img;
  }
}
