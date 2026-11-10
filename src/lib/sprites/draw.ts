import { Buf, dark, light, mix } from "./pixel";
import type { Design, Role } from "./designs";

type V = [number, number];
export interface Pose {
  bob: number; lean: number; fF: V; fB: V; hF: V; hB: V; wA: number; arc: number; glow: number; flash: boolean; sway: number;
}
const P = (o: Partial<Pose>): Pose => ({ bob: 0, lean: 0, fF: [3, 0], fB: [-4, 0], hF: [5, 9], hB: [-4, 9], wA: 25, arc: 0, glow: 0, flash: false, sway: 0, ...o });

export const ANIMS = [
  { name: "idle", n: 4 }, { name: "walk", n: 6 }, { name: "attack", n: 5 }, { name: "cast", n: 5 }, { name: "hurt", n: 2 }, { name: "windup", n: 2 },
] as const;
export type AnimName = (typeof ANIMS)[number]["name"];
export const COLS = 6;

export function pose(anim: AnimName, i: number, n: number): Pose {
  const ph = (2 * Math.PI * i) / n, s = Math.sin(ph), c = Math.cos(ph);
  switch (anim) {
    case "idle": return P({ bob: i === 1 || i === 2 ? 1 : 0, hF: [5, 9 + (i % 2)], hB: [-4, 9 + (i === 2 ? 1 : 0)], sway: s });
    case "walk":
      return P({
        bob: Math.abs(s) * 1.5, lean: 1, sway: s,
        fF: [3 + 6 * s, -Math.max(0, c) * 4], fB: [-4 - 6 * s, -Math.max(0, -c) * 4],
        hF: [5 - 2 * s, 9], hB: [-4 + 5 * s, 9], wA: 30 + 6 * s,
      });
    case "attack":
      return [
        P({ lean: -2, hF: [-2, -7], wA: -25, fF: [1, 0], fB: [-6, 0] }),
        P({ lean: -3, bob: 1, hF: [-4, -11], wA: -55, fF: [0, 0], fB: [-7, 0], hB: [-6, 6] }),
        P({ lean: 3, bob: 1, hF: [11, 3], wA: 100, arc: 1, fF: [8, 0], fB: [-5, 0], hB: [-1, 7] }),
        P({ lean: 4, bob: 1, hF: [10, 7], wA: 125, arc: 2, fF: [8, 0], fB: [-4, 0], hB: [-1, 8] }),
        P({ lean: 1, hF: [6, 9], wA: 55 }),
      ][i];
    case "cast":
      return [
        P({ lean: -1, glow: 0.3, hF: [4, 4], hB: [-3, 5], wA: 10 }),
        P({ lean: -1, glow: 0.6, hF: [3, -9], hB: [-2, -8], wA: 0, bob: 1 }),
        P({ glow: 1, hF: [3, -12], hB: [-1, -10], wA: -5, bob: 1 }),
        P({ lean: 3, glow: 1, arc: 3, hF: [12, -3], hB: [9, -1], wA: 80, fF: [6, 0] }),
        P({ lean: 1, glow: 0.4, hF: [7, 4], hB: [3, 6], wA: 35 }),
      ][i];
    case "hurt":
      return P({ lean: -3, bob: 1, flash: i === 0, fF: [4, 0], fB: [-6, 0], hF: [2, 6], hB: [-6, 6], wA: -10, sway: -1 });
    case "windup":
      return P({ lean: i ? -3 : -2, bob: 2, glow: 0.5, hF: [-2, -8 - i], hB: [-4, 4], wA: -35, fF: [5, 0], fB: [-7, 0] });
  }
}

interface Build { leg: number; legR: number; torso: number; tw: number; bw: number; head: number; arm: number; sh: number }
const BUILD: Record<Role, Build> = {
  tank: { leg: 12, legR: 3.4, torso: 16, tw: 20, bw: 15, head: 6.2, arm: 3.2, sh: 4 },
  healer: { leg: 12, legR: 2.4, torso: 14, tw: 11, bw: 13, head: 5.4, arm: 2.4, sh: 3 },
  dps: { leg: 16, legR: 2.6, torso: 13, tw: 12, bw: 10, head: 5.2, arm: 2.4, sh: 3 },
};
const GY = 60;
const WOOD = 0x8b5a2b;

function ik(a: V, b: V, l1: number, l2: number, bend: number): V {
  let dx = b[0] - a[0], dy = b[1] - a[1];
  const d = Math.min(Math.hypot(dx, dy) || 0.01, l1 + l2 - 0.05);
  const ux = dx / (Math.hypot(dx, dy) || 1), uy = dy / (Math.hypot(dx, dy) || 1);
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  return [a[0] + ux * x - uy * h * bend, a[1] + uy * x + ux * h * bend];
}

export function drawFighter(b: Buf, d: Design, p: Pose, t: number) {
  const B = BUILD[d.cls], hx = 32, hipY = GY - B.leg + p.bob, sx = hx + p.lean, sy = hipY - B.torso;
  const legCol = d.cls === "tank" ? d.sub : d.cls === "healer" ? d.main : d.sub;
  const armCol = d.cls === "tank" ? d.metal : d.cls === "healer" ? d.main : d.tier >= 2 ? d.main : d.skin;
  const goldTrim = d.tier >= 3 ? 0xffcd75 : d.trim;
  const bootCol = dark(d.cls === "tank" ? d.metal : d.sub, 0.3);

  const leg = (front: boolean) => {
    const hip: V = [hx + (front ? 2 : -2), hipY], f = front ? p.fF : p.fB, foot: V = [32 + f[0], GY + f[1]];
    const k = ik(hip, foot, B.leg * 0.56, B.leg * 0.56, -1);
    b.part(legCol, !front).cap(hip[0], hip[1], k[0], k[1], B.legR).cap(k[0], k[1], foot[0], foot[1] - 1, B.legR * 0.9);
    b.part(bootCol, !front).ell(foot[0] + 1.5, foot[1] - 1.2, B.legR + 1.6, 2.2);
  };
  const shoulder = (front: boolean): V => [sx + (front ? B.sh : -B.sh), sy + 2];
  const arm = (front: boolean, col = armCol) => {
    const s = shoulder(front), h = front ? p.hF : p.hB, t2: V = [s[0] + h[0], s[1] + h[1]], e = ik(s, t2, 7.5, 7.5, front ? 1 : -1 * 0 + 1);
    b.part(col, !front).cap(s[0], s[1], e[0], e[1], B.arm).cap(e[0], e[1], t2[0], t2[1], B.arm * 0.9);
    b.part(d.cls === "tank" ? dark(d.metal, 0.1) : d.skin, !front).ell(t2[0], t2[1], 2.2, 2.2);
    return t2;
  };

  // ---- back layer
  leg(false);
  if (d.off === "dagger") dagger(b, d, arm(false), p.wA - 70);
  else if (d.off !== "shield") arm(false);
  if (d.tier >= 2 && d.cls !== "healer" || d.tier >= 3) {
    const long = d.tier >= 3 ? 12 : 8, w = p.sway * 2;
    b.part(d.sub, true).poly([[sx - 2, sy], [sx + 1, sy + 1], [hx - 3 - long - w - p.lean, hipY + long], [hx - 6 - w, hipY + long + 2], [sx - 6, sy + 6]]);
    if (d.tier >= 3) b.part(goldTrim, true).rect(hx - 8 - long - w, hipY + long + 1, 6, 1);
  }

  // ---- torso / robe
  if (d.cls === "healer") {
    const sw = p.sway;
    b.part(d.main).poly([[sx - 5, sy], [sx + 5, sy], [hx + 9 + sw, GY - 3], [hx - 9 + sw, GY - 3]]).ell(sx, sy + 1, 5.5, 3);
    b.part(d.sub).rect(sx - 1 + p.lean * 0.3, sy + 3, 3, GY - 6 - sy - 3 + 0);
    b.part(d.trim).rect(hx - 9 + sw, GY - 5, 18, 2);
    b.part(light(d.sub, 0.2)).rect(sx - 5, sy + 6, 11, 2);
    leg(true);
  } else if (d.cls === "tank") {
    b.part(d.main).poly([[sx - 10, sy + 1], [sx + 10, sy + 1], [hx + 7, hipY + 2], [hx - 7, hipY + 2]]).ell(sx, sy + 2, 9.5, 4);
    b.part(light(d.metal, 0.1)).poly([[sx - 6, sy + 3], [sx + 7, sy + 3], [hx + 5, hipY - 2], [hx - 5, hipY - 2]]);
    b.part(d.trim).rect(hx - 7, hipY - 1, 15, 3);
    b.part(d.sub).poly([[hx - 6, hipY + 2], [hx + 7, hipY + 2], [hx + 6, hipY + 7], [hx - 5, hipY + 7]]);
    leg(true);
  } else {
    leg(true);
    b.part(d.main).poly([[sx - 5, sy], [sx + 6, sy], [hx + 5, hipY + 1], [hx - 4, hipY + 1]]).ell(sx + 0.5, sy + 1.5, 5.5, 3);
    b.part(d.trim).rect(hx - 4, hipY - 1, 10, 2);
    if (d.tier >= 1) b.part(d.trim).rect(sx - 4, sy + 4, 9, 1);
  }
  if (d.tier >= 2) { b.px(sx + 1, sy + 6, d.glow); b.px(sx + 2, sy + 6, light(d.glow, 0.5)); b.px(sx + 1, sy + 7, d.glow); }

  // scarf (dps) trails behind
  if (d.cls === "dps") {
    const w = p.sway * 2;
    b.part(d.tier >= 3 ? d.trim : d.trim === 0xf4f4f4 ? d.main : d.trim, true).poly([[sx - 1, sy - 1], [sx + 3, sy + 1], [sx - 8 - w - p.lean, sy + 6 + w * 0.5], [sx - 11 - w, sy + 3 - w * 0.5]]);
  }

  // ---- head
  const hcx = sx + 1 + p.lean * 0.3, hcy = sy - B.head + 1.5, r = B.head;
  drawHead(b, d, hcx, hcy, r, p, t);

  // ---- tank pauldrons
  if (d.cls === "tank" || d.tier >= 2 && d.cls === "dps") {
    const big = d.cls === "tank";
    b.part(d.metal).ell(sx + 5, sy + 1, big ? 5.5 : 4, big ? 4.5 : 3.2);
    if (d.tier >= 1 && big) b.part(d.trim).rect(sx + 1, sy + 3, 9, 1);
    if (d.tier >= 2) { b.part(light(d.metal, 0.2)).poly([[sx + 4, sy - 3], [sx + 6, sy - 8 - d.tier], [sx + 8, sy - 2]]); }
    if (d.tier >= 3) b.part(d.trim).poly([[sx - 6, sy - 2], [sx - 8, sy - 9], [sx - 3, sy - 3]]);
  }
  if (d.cls === "healer" && d.tier >= 1) b.part(d.trim).rect(sx - 5, sy + 2, 4, 1);
  if (d.off === "satchel") { b.part(WOOD).ell(hx - 4, hipY + 3, 3.5, 3); b.px(hx - 1, hipY - 2, WOOD); b.px(hx, hipY - 3, WOOD); }

  // ---- front arm + weapon, offhand
  const hand = arm(true);
  const tip = weapon(b, d, hand, p.wA, p.glow);
  if (d.off === "shield") {
    const s = shoulder(false), cx = s[0] + 9 + p.hB[0] * 0.3, cy = s[1] + 7 + (p.hB[1] - 9) * 0.5;
    arm(false);
    b.part(d.metal).ell(cx, cy, 6.5, 8.5);
    b.part(d.main).ell(cx, cy, 4.6, 6.6);
    b.part(d.trim).ell(cx, cy, 2.2, 2.6);
    if (d.tier >= 2) b.px(cx, cy, d.glow);
  }

  // ---- halo, effects
  if (d.halo) for (let a = 0; a < 24; a++) { const q = (a / 24) * 6.283; b.fxp(hcx + Math.cos(q) * 6.5, hcy - r - 3 + Math.sin(q) * 1.8, a % 6 < 5 ? 0xffe9a8 : 0xffffff); }
  effects(b, d, p, shoulder(true), hand, tip, t);
}

function drawHead(b: Buf, d: Design, x: number, y: number, r: number, p: Pose, t: number) {
  const ry = r * 1.05, eye = d.head === "hood" && d.tier >= 3 ? d.glow : 0x1a1c2c;
  const face = () => { b.part(d.skin).ell(x, y, r, ry); };
  const eyes = (c = eye) => { b.px(x + r * 0.55, y - 0.5, c); b.px(x + r * 0.55, y + 0.5, c); };
  const w = p.sway * 1.5;
  switch (d.head) {
    case "helm":
      b.part(dark(d.metal, 0.35), true).ell(x - 1, y + 1, r + 1, ry + 0.5);
      b.part(d.metal).ell(x, y - 0.5, r + 0.8, ry + 0.4);
      b.part(d.skin).rect(x + 1, y + 1, r - 1, 3);
      b.px(x + 2, y + 2, 0x1a1c2c); b.px(x + 4, y + 2, 0x1a1c2c);
      b.part(d.trim).rect(x - 5, y - 1, 11, 1);
      if (d.tier >= 2) b.part(d.main).poly([[x - 2, y - ry], [x - 9 - w, y - ry + 3 - d.tier], [x - 11 - w, y + 2], [x - 6, y - 1]]);
      break;
    case "crown":
      face(); b.part(d.hair).ell(x - 1.5, y - 2, r, ry * 0.75); eyes();
      b.part(0xffcd75).rect(x - 5, y - ry, 11, 3).poly([[x - 5, y - ry], [x - 4, y - ry - 5], [x - 2, y - ry], [x, y - ry - 6], [x + 2, y - ry], [x + 4, y - ry - 5], [x + 6, y - ry]]);
      b.px(x, y - ry - 1, 0xb13e53); b.px(x - 4, y - ry + 1, 0x73eff7); b.px(x + 4, y - ry + 1, 0x73eff7);
      break;
    case "hood":
      b.part(d.main, true).ell(x - 2, y + 0.5, r + 2.2, ry + 2.3);
      b.part(d.sub).ell(x + 1.5, y + 0.5, r * 0.75, ry * 0.8);
      b.part(d.main).poly([[x - 7, y - 4], [x, y - ry - 3], [x + 5, y - 3], [x + 2, y - 5]]);
      eyes(d.tier >= 3 ? d.glow : 0xf4f4f4); b.px(x + r * 0.55 - 1, y, d.tier >= 3 ? d.glow : 0xf4f4f4);
      b.part(d.main, true).poly([[x - 6, y + 3], [x - 12 - w, y + 9], [x - 4, y + 7]]);
      break;
    case "gele": {
      face(); eyes();
      b.part(d.main).ell(x - 0.5, y - 3, r + 1.8, ry * 0.65);
      b.part(d.trim).rect(x - 6, y - 4, 13, 1);
      b.part(d.sub).poly([[x - 3, y - 5], [x - 1, y - ry - 6 - d.tier], [x + 3, y - ry - 2], [x + 5, y - 5]]);
      b.part(d.trim).rect(x - 1, y - ry - 3, 3, 1);
      b.part(d.main).poly([[x - 6, y - 3], [x - 10 - w, y - 8], [x - 8 - w, y - 2]]);
      break; }
    case "bandana":
      face(); b.part(d.hair).ell(x - 1, y - 2.5, r, ry * 0.65); eyes();
      b.part(d.trim === 0xf4f4f4 ? 0xf4f4f4 : d.trim).rect(x - 6, y - 3, 12, 2);
      b.part(d.trim, true).poly([[x - 6, y - 3], [x - 12 - w, y - 1 + w * 0.5], [x - 11 - w, y + 2], [x - 6, y - 1]]);
      break;
    case "cap":
      face(); eyes();
      b.part(d.hair, true).ell(x - 2, y, r + 0.5, ry);
      face(); eyes();
      b.part(d.main).ell(x - 0.5, y - 3, r + 0.8, ry * 0.62).rect(x, y - 3, r + 4, 2);
      if (d.weapon === "wand") { b.part(d.glow).ell(x + 2, y - 3.5, 2, 1.6); b.part(0x333c57).rect(x - 5, y - 3, 11, 1); }
      else b.part(d.trim).rect(x - 5, y - 4, 10, 1);
      break;
    case "veil":
      b.part(d.main, true).ell(x - 2, y + 2, r + 2, ry + 4);
      face(); eyes();
      b.part(d.main).ell(x - 0.5, y - 2.5, r + 1.4, ry * 0.7);
      b.part(d.sub).rect(x - 6, y - 3, 12, 1);
      b.part(d.trim).rect(x - 1, y - ry - 1, 2, 1);
      break;
    default:
      b.part(d.hair, true).ell(x - 2, y, r + 0.5, ry);
      face(); eyes();
      b.part(d.hair).ell(x - 1, y - 2.8, r, ry * 0.6);
      if (d.weapon === "cane") { b.px(x - 3, y - ry - 1, 0xf4f4f4); b.px(x, y - ry - 1, 0xf4f4f4); b.px(x + 3, y - ry - 1, 0xf4f4f4); }
  }
  void t;
}

function weapon(b: Buf, d: Design, h: V, ang: number, glow: number): V {
  const a = (ang * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a), px = Math.cos(a), py = Math.sin(a);
  const at = (l: number, o = 0): V => [h[0] + dx * l + px * o, h[1] + dy * l + py * o];
  const line = (l1: number, l2: number, r: number, c: number) => { const s = at(l1), e = at(l2); b.part(c).cap(s[0], s[1], e[0], e[1], r); };
  const hot = d.tier >= 3 || glow > 0.5;
  let tip: V = at(14);
  switch (d.weapon) {
    case "sword": line(-3, 2, 1, WOOD); line(2, 2.5, 3, d.trim); line(2, 17, 1.3, light(d.metal, 0.4)); tip = at(17); break;
    case "mace": line(-3, 14, 1.1, WOOD); { const c = at(16.5); b.part(d.tier >= 2 ? 0xffcd75 : d.metal).ell(c[0], c[1], 3.6, 3.6); tip = c; } break;
    case "axe": {
      line(-3, 18, 1.1, WOOD);
      const q = (l: number, o: number) => at(l, o);
      b.part(d.metal).poly([q(10, 0.5), q(19, 0.5), q(20, 7), q(12, 6)]);
      b.part(light(d.metal, 0.4)).poly([q(18, 3), q(20, 7), q(13, 6)]);
      tip = at(17, 5); break; }
    case "hammer": {
      line(-3, 15, 1.4, WOOD);
      b.part(d.metal).poly([at(12, -4.5), at(12, 4.5), at(20, 4.5), at(20, -4.5)]);
      b.part(d.trim).poly([at(15, -4.5), at(15, 4.5), at(16.5, 4.5), at(16.5, -4.5)]);
      tip = at(16, 0); break; }
    case "pipe": line(-2, 17, 1.7, d.metal); line(-2, 2, 1.8, d.trim); tip = at(17); break;
    case "dagger": dagger(b, d, h, ang); tip = at(9); break;
    case "staff": case "crook": case "cross": case "cane": case "wand": {
      const top = d.weapon === "cane" ? 8 : d.weapon === "wand" ? 11 : 18;
      line(-12 * (d.weapon === "wand" ? 0.3 : 1), top, d.weapon === "wand" ? 0.9 : 1.1, d.weapon === "cane" ? 0x5c3317 : WOOD);
      const e = at(top + 1);
      if (d.weapon === "staff") { b.part(d.metal).ell(e[0], e[1], 3.3, 3.3); b.part(d.glow).ell(e[0], e[1], 2, 2); }
      else if (d.weapon === "crook") { for (const [l, o] of [[3, 3], [1, -3.5], [5, 0]] as [number, number][]) { const c = at(top + l, o); b.part(0x38b764).ell(c[0], c[1], 2.4, 1.6); } b.part(0xa7f070).ell(e[0], e[1], 1.6, 1.6); }
      else if (d.weapon === "cross") { b.part(d.metal).rect(e[0] - 1, e[1] - 5, 3, 10).rect(e[0] - 4, e[1] - 2, 9, 3); b.px(e[0], e[1] - 1, d.glow); }
      else if (d.weapon === "cane") { b.part(0xf4f4f4).ell(e[0], e[1], 3, 3); b.part(d.glow).rect(e[0] - 1, e[1] - 6, 2, 3); b.px(e[0] - 1, e[1], 0x1a1c2c); b.px(e[0] + 1, e[1], 0x1a1c2c); }
      else { b.part(d.glow).ell(e[0], e[1], 2.4, 2.4); b.px(e[0], e[1], 0xffffff); }
      tip = e; break; }
  }
  if (hot && d.weapon !== "staff") for (let k = 0; k < 3; k++) b.fxp(tip[0] + (k - 1) * 2, tip[1] - 3 + (k % 2) * 6, d.glow);
  return tip;
}

function dagger(b: Buf, d: Design, h: V, ang: number) {
  const a = (ang * Math.PI) / 180, dx = Math.sin(a), dy = -Math.cos(a);
  b.part(0x333c57).cap(h[0] - dx * 2, h[1] - dy * 2, h[0] + dx, h[1] + dy, 1);
  b.part(d.tier >= 3 ? light(d.glow, 0.3) : light(d.metal, 0.35)).cap(h[0] + dx, h[1] + dy, h[0] + dx * 10, h[1] + dy * 10, 1.1);
}

function effects(b: Buf, d: Design, p: Pose, sh: V, hand: V, tip: V, t: number) {
  const white = 0xffffff, hue = light(d.glow, 0.4);
  if (p.arc === 1 || p.arc === 2) {
    const a0 = p.arc === 1 ? 10 : 70, a1 = p.arc === 1 ? 100 : 150;
    for (let q = a0; q <= a1; q += 3) {
      const r = (q * Math.PI) / 180, k = (q - a0) / (a1 - a0), R = 19;
      const x = sh[0] + Math.sin(r) * R, y = sh[1] + 1 - Math.cos(r) * R;
      b.fxp(x, y, p.arc === 1 ? (k > 0.5 ? white : hue) : k > 0.6 ? hue : d.glow);
      if (k > 0.35 && p.arc === 1) b.fxp(x - Math.sin(r) * 1.5, y + Math.cos(r) * 1.5, white);
    }
  }
  if (p.arc === 3) {
    for (let a = 0; a < 12; a++) { const q = (a / 12) * 6.283; b.fxp(hand[0] + 6 + Math.cos(q) * 5, hand[1] + Math.sin(q) * 5, a % 2 ? d.glow : white); }
    for (let k = 1; k < 5; k++) b.fxp(hand[0] + 6 + k * 3, hand[1], k % 2 ? white : d.glow);
  }
  if (p.glow > 0) {
    const g: V = d.weapon === "staff" || d.weapon === "wand" || d.weapon === "cross" || d.weapon === "cane" ? tip : [hand[0] + 2, hand[1] - 3];
    const rad = 1 + p.glow * 3;
    for (let a = 0; a < 8; a++) { const q = (a / 8) * 6.283 + p.glow * 3; b.fxp(g[0] + Math.cos(q) * rad, g[1] + Math.sin(q) * rad, a % 2 ? d.glow : white); }
    if (p.glow >= 0.9) b.fxp(g[0], g[1], white);
  }
  // rarity sparkles: rising embers
  const n = d.tier >= 3 ? 7 : d.tier === 2 ? 3 : 0;
  for (let k = 0; k < n; k++) {
    const f = (t + k / n) % 1, x = 32 + (k % 2 ? 1 : -1) * (9 + ((k * 7) % 11)), y = 58 - f * 46, c = k % 3 ? d.glow : 0xffffff;
    b.fxp(x, y, c);
    if (f > 0.25 && f < 0.75 && d.tier >= 3) { b.fxp(x - 1, y, c); b.fxp(x + 1, y, c); b.fxp(x, y - 1, c); b.fxp(x, y + 1, c); }
  }
  void mix; void dark;
}
