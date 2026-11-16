"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { RoomScene, depth, pct, type SceneLayout } from "@/components/room/RoomScene";
import { Speech, SpeechActions } from "@/components/room/Speech";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { GuildFighter } from "@/lib/guild";
import { buildNav, findPath, nearestWalkable, type Pt } from "@/lib/guild-nav";
import { getFloorSocket } from "@/lib/socket";
import type { Role } from "@/lib/sprites/designs";
import { StoragePanel } from "./StoragePanel";
import layout from "./lobby-layout.json";

const scene = layout as unknown as SceneLayout;
const nav = buildNav({ ...scene, props: [...scene.props, ...scene.npcs.map((n) => ({ foot: n.foot }))] });
const SPEED = 2.6; // tiles per second
const FORMATION: Pt[] = [[0, 0], [-0.9, 0.6], [0.9, 0.6]];
const FRAME = scene.frame;

interface Agent { x: number; y: number; path: Pt[]; tx?: number; ty?: number }
interface Remote { id: string; uid: string; name: string; sprite: string; role: Role; level: number; lead: boolean }
interface Look { walking: boolean; flip: boolean }
interface WireFighter { id: string; sprite: string; name: string; role: Role; level: number; x?: number; y?: number; dead?: boolean }
interface WirePlayer { uid: string; name: string; fighters: WireFighter[] }

type Talk = "arena" | "classes" | "storage" | null;

/**
 * The Main Lobby. The party was chosen in the guild before heading here; they appear at the stairs and you tap the
 * floor to walk them about. Everyone in the same lobby sees each other's fighters live.
 */
export function LobbyScreen({ fighters }: { fighters: GuildFighter[] }) {
  const mine = fighters.filter((f) => f.team_slot > 0).sort((a, b) => a.team_slot - b.team_slot);
  return <Lobby mine={mine} />;
}

function Lobby({ mine }: { mine: GuildFighter[] }) {
  const stage = useRef<HTMLDivElement>(null);
  const agents = useRef(new Map<string, Agent>());
  const els = useRef(new Map<string, HTMLElement>());
  const [remote, setRemote] = useState<Remote[]>([]);
  const [looks, setLooks] = useState<Record<string, Look>>({});
  const [talk, setTalk] = useState<Talk>(null);
  const [here, setHere] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const dirty = useRef(true);

  const patch = (id: string, l: Partial<Look>) =>
    setLooks((all) => {
      const cur = all[id] ?? { walking: false, flip: false };
      const next = { ...cur, ...l };
      return all[id] && next.walking === cur.walking && next.flip === cur.flip ? all : { ...all, [id]: next };
    });

  // Our fighters appear at the stairs, side by side.
  const place = (id: string, i: number) => {
    const m = agents.current;
    if (m.has(id)) return m.get(id)!;
    const at = nearestWalkable(nav, scene.arrive![0] + FORMATION[i % 3][0], scene.arrive![1] + FORMATION[i % 3][1]);
    const a: Agent = { x: at[0], y: at[1], path: [] };
    m.set(id, a);
    return a;
  };

  useEffect(() => {
    const sock = getFloorSocket();
    let me = "";
    const addPlayer = (p: WirePlayer) => {
      setRemote((cur) => [...cur.filter((r) => r.uid !== p.uid), ...p.fighters.map((f, i) => ({ id: f.id, uid: p.uid, name: p.name, sprite: f.sprite, role: f.role, level: f.level, lead: i === 0 }))]);
      for (const f of p.fighters) {
        const placed = f.x !== undefined && !(f.dead && !f.x && !f.y);
        const at = placed ? [f.x!, f.y!] : scene.arrive!;
        agents.current.set(f.id, { x: at[0], y: at[1], path: [], tx: at[0], ty: at[1] });
      }
    };
    const join = () => sock.emit("join", { floor: 0 }, (r: { ok?: boolean; you: string; n: number; players: WirePlayer[] }) => {
      if (!r?.ok) { setOffline(true); return; }
      me = r.you; setOffline(false); setHere(r.n);
      setRemote([]);
      for (const p of r.players) if (p.uid !== me) addPlayer(p);
      dirty.current = true;
    });
    const onSnap = (s: { p: [string, [string, number, number, number, number][]][]; n: number }) => {
      setHere(s.n);
      for (const [uid, list] of s.p) {
        if (uid === me) continue;
        for (const [id, x, y] of list) {
          const a = agents.current.get(id);
          if (!a) continue;
          if (a.tx === undefined || (a.tx === scene.arrive![0] && a.ty === scene.arrive![1] && !a.path.length && Math.hypot(a.x - x, a.y - y) > 3)) { a.x = x; a.y = y; }
          a.tx = x; a.ty = y;
        }
      }
    };
    const onJoined = (j: { player?: WirePlayer; n: number }) => { if (j.player && j.player.uid !== me) addPlayer(j.player); setHere(j.n); };
    const onLeft = (j: { uid: string; n: number }) => {
      setRemote((cur) => { for (const r of cur) if (r.uid === j.uid) { agents.current.delete(r.id); els.current.delete(r.id); } return cur.filter((r) => r.uid !== j.uid); });
      setHere(j.n);
    };
    sock.on("connect", join);
    sock.on("connect_error", () => setOffline(true));
    sock.on("s", onSnap); sock.on("joined", onJoined); sock.on("left", onLeft);
    if (sock.connected) join(); else sock.connect();

    let raf = 0, last = performance.now(), lastSend = 0;
    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      for (const [id, a] of agents.current) {
        const el = els.current.get(id);
        const remoteOne = a.tx !== undefined;
        let moving = false;
        if (remoteOne) {
          const dx = a.tx! - a.x, dy = a.ty! - a.y, k = Math.min(1, dt * 10);
          moving = Math.abs(dx) + Math.abs(dy) > 0.03;
          if (Math.abs(dx) > 0.04) patch(id, { flip: dx < 0 });
          a.x += dx * k; a.y += dy * k;
        } else if (a.path.length) {
          const [px, py] = a.path[0], dx = px - a.x, dy = py - a.y, d = Math.hypot(dx, dy), step = SPEED * dt;
          moving = true;
          if (Math.abs(dx) > 0.02) patch(id, { flip: dx < 0 });
          if (d <= step) { a.x = px; a.y = py; a.path.shift(); } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
          dirty.current = true;
        }
        patch(id, { walking: moving });
        if (el) { el.style.left = pct(a.x, scene.cols); el.style.top = pct(a.y, scene.rows); el.style.zIndex = String(depth(a.y)); el.style.visibility = "visible"; }
      }
      // Tell the lobby where our fighters are (when they moved, and now and then so latecomers find them).
      if (sock.connected && (dirty.current ? t - lastSend > 150 : t - lastSend > 3000)) {
        lastSend = t; dirty.current = false;
        const r2 = (n: number) => Math.round(n * 100) / 100;
        sock.emit("u", { p: mine.map((f) => { const a = agents.current.get(f.id); return a ? [f.id, r2(a.x), r2(a.y), 1, 0] : [f.id, 0, 0, 1, 1]; }) });
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      sock.emit("leave");
      sock.off("connect", join); sock.off("s", onSnap); sock.off("joined", onJoined); sock.off("left", onLeft);
      sock.disconnect();
    };
    // Starts once; everything else is read through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onFloor = (e: PointerEvent<HTMLDivElement>) => {
    if (!stage.current) return;
    const r = stage.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * scene.cols;
    const y = ((e.clientY - r.top) / r.height) * scene.rows;
    if (y < scene.floor.y0 - 0.6) return; // that's the wall
    mine.forEach((f, i) => {
      const a = agents.current.get(f.id);
      if (!a) return;
      a.path = findPath(nav, [a.x, a.y], nearestWalkable(nav, x + FORMATION[i % 3][0], y + FORMATION[i % 3][1]));
    });
  };

  const frameW = (FRAME / scene.cols) * 100;
  const sprite = (id: string, key: string, role: Role, level: number, tag: string | null, own: boolean) => {
    const look = looks[id] ?? { walking: false, flip: false };
    return (
      <div
        key={id}
        ref={(el) => {
          if (!el) return;
          els.current.set(id, el);
          const a = own ? place(id, mine.findIndex((f) => f.id === id)) : agents.current.get(id);
          if (a && !el.style.left) { el.style.left = pct(a.x, scene.cols); el.style.top = pct(a.y, scene.rows); el.style.zIndex = String(depth(a.y)); el.style.visibility = "visible"; }
        }}
        className="pointer-events-none absolute -translate-x-1/2 -translate-y-[90%]"
        style={{ width: `${frameW}%`, visibility: "hidden" }}
      >
        <span className="absolute bottom-[8%] left-1/2 h-[7%] w-[34%] -translate-x-1/2 rounded-full bg-ink/40" />
        {tag && <span className={`absolute left-1/2 top-[14%] -translate-x-1/2 whitespace-nowrap px-1 text-[clamp(9px,1.3cqw,15px)] ${own ? "bg-gold text-ink" : "bg-ink/80 text-paper"}`}>{tag}</span>}
        <span className="absolute left-1/2 top-[21%] -translate-x-1/2 whitespace-nowrap bg-ink/80 px-1 text-[clamp(9px,1.3cqw,15px)] text-paper">Lv {level}</span>
        <FighterSprite spriteKey={key} role={role} rest={look.walking ? "walk" : "idle"} flip={look.flip} />
      </div>
    );
  };

  return (
    <div className="flex min-h-dvh flex-col bg-ink">
      <div className="flex items-center gap-3 bg-night/90 px-3 py-2 text-paper">
        <Link href="/home" className="pixel-box bg-panel px-3 py-1 text-lg uppercase">← Guild</Link>
        <h1 className="flex-1 text-2xl uppercase text-gold">Main Lobby</h1>
        <p className="pixel-box bg-panel px-2 py-1 text-base uppercase leading-tight text-paper">{offline ? "Offline" : here === null ? "…" : `${here} here`}</p>
      </div>
      <div className="mx-auto w-full max-w-5xl">
        <RoomScene layout={scene} innerRef={stage} onPointerDown={onFloor} onAction={(a) => setTalk(a as Talk)}>
          {remote.map((r) => sprite(r.id, r.sprite, r.role, r.level, r.lead ? r.name : null, false))}
          {mine.map((f, i) => sprite(f.id, f.template.sprite_key, f.template.role, f.level, i === 0 ? "You" : null, true))}
        </RoomScene>
      </div>
      <p className="px-4 py-3 text-center text-xl text-steel">{offline ? "Can't reach the lobby right now: you're on your own." : "Tap the floor to walk. Tap a person to talk."}</p>

      {talk === "arena" && (
        <Speech npc="gladiator" title="The Arena" onClose={() => setTalk(null)}>
          <p>Think your fighters are tough? Test them against other guilds.</p>
          <SpeechActions>
            <Link href="/arena"><PixelButton className="w-full">Enter the arena</PixelButton></Link>
            <PixelButton variant="ghost" onClick={() => setTalk(null)}>Not now</PixelButton>
          </SpeechActions>
        </Speech>
      )}
      {talk === "classes" && (
        <Speech npc="class_changer" title="Class Changer" onClose={() => setTalk(null)}>
          <p>I help fighters take up a new calling.</p>
          <p className="text-steel">Coming soon: change a fighter&apos;s class here.</p>
          <SpeechActions><PixelButton variant="ghost" onClick={() => setTalk(null)}>Okay</PixelButton></SpeechActions>
        </Speech>
      )}
      {talk === "storage" && (
        <Speech npc="storage_keeper" title="Storage" wide onClose={() => setTalk(null)}>
          <p className="text-steel">Keep your spare items safe in a box with more room than your bag.</p>
          <StoragePanel />
        </Speech>
      )}
    </div>
  );
}
