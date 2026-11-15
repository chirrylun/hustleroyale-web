import { generateFloor, isBossFloor } from "../src/lib/world/floor";

const out: Record<number, { boss: boolean; kinds: Record<string, number>; bossKind: string | null; total: number }> = {};
for (let n = 1; n <= 40; n++) {
  const f = generateFloor(n);
  const kinds: Record<string, number> = {};
  let bossKind: string | null = null;
  for (const m of f.mobs) {
    if (m.boss) bossKind = m.kind;
    else kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
  }
  out[n] = { boss: isBossFloor(n), kinds, bossKind, total: f.mobs.length };
}
console.log(JSON.stringify(out));
