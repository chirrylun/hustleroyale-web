"use client";

import { openPartyPanel, useSocial } from "@/lib/social";
import { JoinBadge } from "@/components/chat/JoinBadge";
import { LiveSprite } from "@/components/sprites/LiveSprite";
import { Music } from "@/components/Music";
import { ArmouryPanel } from "@/components/gear/ArmouryPanel";
import { ForgePanel } from "@/components/gear/ForgePanel";
import { BagButton } from "@/components/floor/BagButton";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { StoragePanel } from "@/components/lobby/StoragePanel";
import { MarketPanel } from "@/components/lobby/MarketPanel";
import { AlchemistPanel } from "@/components/town/AlchemistPanel";
import { LobbyTour } from "@/components/training/LobbyTour";
import { ArenaStation } from "@/components/arena/ArenaStation";
import { CarpenterPanel } from "@/components/town/CarpenterPanel";
import { ClassChangerPanel } from "@/components/town/ClassChangerPanel";
import { Npc, npcRatio, npcFrameH, BODY_OF_FRAME, type NpcName } from "@/components/npc/Npc";
import { PixelButton } from "@/components/pixel/PixelButton";
import { Speech, SpeechActions } from "@/components/room/Speech";
import type { GuildFighter } from "@/lib/guild";
import { buildNav, findPath, nearestWalkable, type Pt } from "@/lib/guild-nav";
import { getFloorSocket } from "@/lib/socket";
import type { Role } from "@/lib/sprites/designs";
import { ATLASES, SCALE, TILE_PX as T, TOWNS, UNIT, navLayoutOf, type TownId, type TownProp } from "@/lib/town/maps";

const SPEED = 2.6; // tiles per second
const FRAME = 3.4; // a fighter's sprite frame, in tiles
/** Tiles across the screen at the default zoom (the picture is zoomed in so the player has to explore). */
const VIEW_TILES = 15; // same framing as the floors
const ZOOM_CAP = 2.3;
const ZOOM_MIN = 0.5; // the base view; pulling in goes up to 1
const FORMATION: Pt[] = [[0, 0], [-0.9, 0.6], [0.9, 0.6]];
/** A tapped sign sends the party to it; this close to it counts as arrived. */
const ARRIVE = 1.7;
/** The figure inside an NPC's frame stands with its feet about this far down the frame. */
const NPC_FEET = 0.97;
/** NPC frame height, in picture pixels, so the body is as tall as a fighter standing in town. */
const npcH = (name: string) => npcFrameH(name as NpcName, (FRAME * T * BODY_OF_FRAME) / SCALE);
const zOf = (yTiles: number) => 10 + Math.round(yTiles * 10);

interface Agent { x: number; y: number; path: Pt[]; tx?: number; ty?: number; walking: boolean; flip: boolean }
interface Look { walking: boolean; flip: boolean }
interface Remote { id: string; uid: string; name: string; sprite: string; role: Role; level: number; lead: boolean }
interface WireFighter { id: string; sprite: string; name: string; role: Role; level: number; x?: number; y?: number; dead?: boolean }
interface WirePlayer { uid: string; name: string; fighters: WireFighter[] }
/** How the loop reaches a figure's element and its look state, by id. */
type Rig = Map<string, { el: HTMLDivElement | null; set: (l: Look) => void }>;

type Talk = "arena" | "challenge" | "boss" | "raid" | "classes" | "alchemist" | "storage" | "merchant" | "armourer" | "blacksmith" | "carpenter" | "guard";
const SPEAKER: Record<Talk, NpcName> = { arena: "gladiator", challenge: "trainer", boss: "gladiator", raid: "guard", classes: "class_changer", alchemist: "alchemist", storage: "storage_keeper", merchant: "merchant", armourer: "guard", blacksmith: "blacksmith", carpenter: "carpenter", guard: "guard" };

function Figure({ id, sprite, role, level, tag, own, rig, join }: { id: string; sprite: string; role: Role; level: number; tag: string | null; own: boolean; rig: Rig; join?: () => void }) {
  const [look, setLook] = useState<Look>({ walking: false, flip: false });
  const size = FRAME * T;
  return (
    <div
      ref={(el) => { if (el) rig.set(id, { el, set: setLook }); else rig.delete(id); }}
      className="pointer-events-none absolute left-0 top-0 will-change-transform"
      // The feet sit at about 90% of the sprite frame, so lift the frame by that much to stand on the point.
      style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size * 0.88, visibility: "hidden" }}
    >
      {join && <JoinBadge onJoin={join} className="absolute left-1/2 top-[-6%] -translate-x-1/2" />}
      {tag && <span className={`absolute left-1/2 top-[14%] -translate-x-1/2 whitespace-nowrap px-1 text-sm ${own ? "bg-gold text-ink" : "bg-ink/80 text-paper"}`}>{tag}</span>}
      <span className="absolute left-1/2 top-[24%] -translate-x-1/2 whitespace-nowrap bg-ink/80 px-1 text-sm text-paper">Lv {level}</span>
      <LiveSprite id={id} spriteKey={sprite} role={role} flip={look.flip} rest={look.walking ? "walk" : "idle"} />
    </div>
  );
}

/**
 * A town map: one painted picture with props and people on it. Your party walks around it (tap the ground to send
 * them there; tap a sign to travel; tap a person to talk). The lobby is shared: everyone in it sees each other's
 * fighters live.
 */
export function TownMap({ id, fighters, tour = false }: { id: TownId; fighters: GuildFighter[]; /** Show the Guild Manager's walk-through (right after training). */ tour?: boolean }) {
  const town = TOWNS[id];
  const ATLAS = ATLASES[id];
  const router = useRouter();
  const nav = useMemo(() => buildNav(navLayoutOf(town, ATLAS)), [town, ATLAS]);
  const mine = useMemo(() => {
    // Only the party leader walks around the lobby and market.
    const team = fighters.filter((f) => f.team_slot > 0).sort((a, b) => a.team_slot - b.team_slot);
    return (team.length ? team : fighters).slice(0, 1);
  }, [fighters]);

  const [rig] = useState<Rig>(() => new Map());
  const agents = useRef(new Map<string, Agent>());
  const [remote, setRemote] = useState<Remote[]>([]);
  const { nearby } = useSocial();
  const recruiting = useMemo(() => new Map(nearby.map((n) => [n.host, n.id])), [nearby]);
  const [talk, setTalk] = useState<Talk | null>(null);
  const [here, setHere] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [label, setLabel] = useState<string | null>(null);
  const dirty = useRef(true);
  const view = useRef<HTMLDivElement>(null);
  const world = useRef<HTMLDivElement>(null);
  const cam = useRef({ x: 0, y: 0, vw: 800, vh: 600, z: 1, zu: ZOOM_MIN, free: false });
  const [free, setFree] = useState(false); // the camera was dragged away from the party
  const WW = town.w * SCALE, WH = town.h * SCALE; // the picture on screen, in px
  const fitZoom = () => { const c = cam.current; c.z = Math.min(ZOOM_CAP, Math.max(1, c.vw / (T * VIEW_TILES))) * c.zu; };
  const marker = useRef<HTMLDivElement>(null);
  const goal = useRef<TownProp | null>(null);

  useEffect(() => {
    const spawn = (i: number): Pt => nearestWalkable(nav, town.spawn[0] / UNIT + FORMATION[i % 3][0], town.spawn[1] / UNIT + FORMATION[i % 3][1]);
    mine.forEach((f, i) => {
      const at = spawn(i);
      agents.current.set(f.id, { x: at[0], y: at[1], path: [], walking: false, flip: false });
    });

    // The shared lobby: other players' fighters appear and move live.
    const sock = town.online ? getFloorSocket() : null;
    let me = "";
    const arrive = town.spawn;
    const addPlayer = (p: WirePlayer) => {
      setRemote((cur) => [...cur.filter((r) => r.uid !== p.uid), ...p.fighters.map((f, i) => ({ id: f.id, uid: p.uid, name: p.name, sprite: f.sprite, role: f.role, level: f.level, lead: i === 0 }))]);
      for (const f of p.fighters) {
        const placed = f.x !== undefined && !(f.dead && !f.x && !f.y);
        const at = placed ? [f.x!, f.y!] : [arrive[0] / UNIT, arrive[1] / UNIT];
        agents.current.set(f.id, { x: at[0], y: at[1], path: [], tx: at[0], ty: at[1], walking: false, flip: false });
      }
    };
    const join = () => sock?.emit("join", { floor: 0 }, (r: { ok?: boolean; you: string; n: number; players: WirePlayer[] }) => {
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
        for (const [rid, x, y] of list) {
          const a = agents.current.get(rid);
          if (!a) continue;
          if (a.tx === undefined) { a.x = x; a.y = y; }
          a.tx = x; a.ty = y;
        }
      }
    };
    const onJoined = (j: { player?: WirePlayer; n: number }) => { if (j.player && j.player.uid !== me) addPlayer(j.player); setHere(j.n); };
    const onLeft = (j: { uid: string; n: number }) => {
      setRemote((cur) => { for (const r of cur) if (r.uid === j.uid) agents.current.delete(r.id); return cur.filter((r) => r.uid !== j.uid); });
      setHere(j.n);
    };
    if (sock) {
      sock.on("connect", join);
      sock.on("connect_error", () => setOffline(true));
      sock.on("s", onSnap); sock.on("joined", onJoined); sock.on("left", onLeft);
      if (sock.connected) join(); else sock.connect();
    }

    let raf = 0, last = performance.now(), lastSend = 0;
    const frame = (t: number) => {
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      for (const [aid, a] of agents.current) {
        let moving = false;
        if (a.tx !== undefined) {
          const dx = a.tx - a.x, dy = a.ty! - a.y, k = Math.min(1, dt * 10);
          moving = Math.abs(dx) + Math.abs(dy) > 0.03;
          if (Math.abs(dx) > 0.04) a.flip = dx < 0;
          a.x += dx * k; a.y += dy * k;
        } else if (a.path.length) {
          const [px, py] = a.path[0], dx = px - a.x, dy = py - a.y, d = Math.hypot(dx, dy), step = SPEED * dt;
          moving = true;
          if (Math.abs(dx) > 0.02) a.flip = dx < 0;
          if (d <= step) { a.x = px; a.y = py; a.path.shift(); } else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
          dirty.current = true;
        }
        const r = rig.get(aid);
        if (r?.el) {
          r.el.style.transform = `translate(${a.x * T}px, ${a.y * T}px)`;
          r.el.style.zIndex = String(zOf(a.y));
          r.el.style.visibility = "visible";
          if (a.walking !== moving || a.flip !== (r.el.dataset.flip === "1")) {
            a.walking = moving;
            r.el.dataset.flip = a.flip ? "1" : "0";
            r.set({ walking: moving, flip: a.flip });
          }
        }
      }

      // Tell the lobby where our fighters are (when they moved, and now and then so latecomers find them).
      if (sock?.connected && (dirty.current ? t - lastSend > 150 : t - lastSend > 3000)) {
        lastSend = t; dirty.current = false;
        const r2 = (n: number) => Math.round(n * 100) / 100;
        sock.emit("u", { p: mine.map((f) => { const a = agents.current.get(f.id); return a ? [f.id, r2(a.x), r2(a.y), 1, 0] : [f.id, 0, 0, 1, 1]; }) });
      }

      // Walking to a sign: go through when the leader gets there.
      const lead = agents.current.get(mine[0]?.id ?? "");
      const g = goal.current;
      if (g?.href && lead && Math.hypot(lead.x - g.x / UNIT, lead.y - (g.y + 36) / UNIT) < ARRIVE) {
        goal.current = null;
        router.push(g.href);
      }

      // Camera: follow the leader; a picture smaller than the screen is centred.
      const c = cam.current, z = c.z, vw = c.vw / z, vh = c.vh / z;
      const tx = lead ? lead.x * T - vw / 2 : 0, ty = lead ? lead.y * T - vh / 2 : 0;
      if (!c.free) { c.x += (tx - c.x) * Math.min(1, dt * 6); c.y += (ty - c.y) * Math.min(1, dt * 6); }
      c.x = WW <= vw ? (WW - vw) / 2 : Math.min(WW - vw, Math.max(0, c.x));
      c.y = WH <= vh ? (WH - vh) / 2 : Math.min(WH - vh, Math.max(0, c.y));
      if (world.current) world.current.style.transform = `scale(${z}) translate(${-c.x}px, ${-c.y}px)`;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const agentMap = agents.current;
    return () => {
      cancelAnimationFrame(raf);
      if (sock) {
        sock.emit("leave");
        sock.off("connect", join); sock.off("s", onSnap); sock.off("joined", onJoined); sock.off("left", onLeft);
        sock.disconnect();
      }
      agentMap.clear();
    };
  }, [town, nav, mine, rig, router, WW, WH]);

  useEffect(() => {
    const el = view.current;
    if (!el) return;
    const ro = new ResizeObserver(() => { cam.current.vw = el.clientWidth; cam.current.vh = el.clientHeight; fitZoom(); });
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const down = useRef<{ x: number; y: number; t: number } | null>(null);
  const local = (e: PointerEvent) => {
    const r = view.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const last = useRef({ x: 0, y: 0 });
  /** Hold and drag to look around; the camera stays where you leave it until you tap to walk or press Follow party. */
  const onMove = (e: PointerEvent) => {
    const d = down.current;
    if (!d || e.buttons === 0) return;
    const p = local(e), c = cam.current;
    if (!c.free && Math.hypot(p.x - d.x, p.y - d.y) < 10) return;
    if (!c.free) { c.free = true; setFree(true); }
    c.x -= (p.x - last.current.x) / c.z; c.y -= (p.y - last.current.y) / c.z;
    last.current = p;
    d.t = 0; // a drag is never a tap
  };
  const recenter = () => { cam.current.free = false; setFree(false); };
  const onUp = (e: PointerEvent) => {
    const d = down.current, p = local(e), c = cam.current;
    down.current = null;
    if (!d || Math.hypot(p.x - d.x, p.y - d.y) > 10 || performance.now() - d.t > 500) return;
    // Screen -> picture pixels.
    const px = (p.x / c.z + c.x) / SCALE, py = (p.y / c.z + c.y) / SCALE;
    // A tap on a person talks to them.
    const person = town.npcs.find((n) => {
      const h = npcH(n.npc), w = h * npcRatio(n.npc as NpcName);
      return Math.abs(px - n.x) < w * 0.4 && py < n.y + 12 && py > n.y - h * NPC_FEET;
    });
    if (person) { setTalk(person.action as Talk); return; }
    recenter();
    // A tap on a sign travels there; anything else is "walk here".
    const sign = town.props.find((s) => {
      if (!s.href) return false;
      const [, , w, h] = ATLAS.rects[s.i];
      return Math.abs(px - s.x) < w / 2 && py < s.y + 20 && py > s.y - h;
    });
    goal.current = sign ?? null;
    const target: Pt = sign ? [sign.x / UNIT, (sign.y + 36) / UNIT] : [px / UNIT, py / UNIT];
    const to = nearestWalkable(nav, target[0], target[1]);
    mine.forEach((f, i) => {
      const a = agents.current.get(f.id);
      if (a) a.path = findPath(nav, [a.x, a.y], nearestWalkable(nav, to[0] + FORMATION[i % 3][0], to[1] + FORMATION[i % 3][1]));
    });
    setLabel(sign?.label ?? null);
    const m = marker.current;
    if (m) { m.style.left = `${to[0] * T}px`; m.style.top = `${to[1] * T}px`; m.classList.remove("marker-ping"); void m.offsetWidth; m.classList.add("marker-ping"); }
  };

  const close = () => setTalk(null);
  const hint = town.online
    ? offline ? "Can't reach the lobby right now: you're on your own." : "Tap the ground to walk · tap a sign to travel · tap a person to talk"
    : "Tap the ground to walk · tap a sign to travel · tap a person to talk";

  return (
    <div className="relative flex h-dvh w-full flex-col bg-ink">
      <BagButton />
      <Music track={id === "market" ? "market" : "lobby"} />
      <div className="z-[9500] flex items-center gap-3 bg-night/90 py-2 pl-3 pr-14 text-paper short:gap-2 short:py-1">
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-lg uppercase text-gold">{town.title}</p>
          <p className="truncate text-sm text-steel">{hint}</p>
        </div>
        {label && <p className="text-lg text-gold">→ {label}</p>}
        {town.online && <button type="button" onClick={() => openPartyPanel()} className="pixel-box bg-panel px-2 py-1 text-base uppercase leading-tight text-paper" title="Parties: start one or join one in this room">{offline ? "Offline" : here === null ? "…" : `${here} here`}</button>}
      </div>

      <div
        ref={view}
        className="relative min-h-0 flex-1 touch-none select-none overflow-hidden"
        onPointerDown={(e) => { down.current = { ...local(e), t: performance.now() }; last.current = local(e); }}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={() => { down.current = null; }}
        onWheel={(e) => { const c = cam.current; c.zu = Math.min(1, Math.max(ZOOM_MIN, c.zu + (e.deltaY > 0 ? -0.07 : 0.07))); fitZoom(); }}
      >
        {free && <button type="button" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={recenter} className="pixel-box absolute bottom-3 right-3 z-[9600] bg-night/90 px-3 py-1 text-lg uppercase text-paper">Follow party</button>}
        <div ref={world} className="absolute left-0 top-0 origin-top-left" style={{ width: WW, height: WH, containerType: "inline-size" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={town.ground} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
          {town.props.map((p, k) => {
            const [rx, ry, rw, rh] = ATLAS.rects[p.i];
            return (
              <div
                key={k}
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  left: (p.x - rw / 2) * SCALE, top: (p.y - rh) * SCALE, width: rw * SCALE, height: rh * SCALE,
                  backgroundImage: `url(/town/props_${id}.png)`, backgroundSize: `${ATLAS.w * SCALE}px ${ATLAS.h * SCALE}px`,
                  backgroundPosition: `${-rx * SCALE}px ${-ry * SCALE}px`, zIndex: p.flat ? 2 : zOf(p.y / UNIT),
                }}
              />
            );
          })}
          {town.props.filter((p) => p.href).map((p, k) => (
            <span
              key={k}
              className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap bg-ink px-1.5 text-[clamp(10px,1.6cqw,18px)] uppercase text-paper"
              style={{ left: p.x * SCALE, top: p.y * SCALE + 6, zIndex: 9000 }}
            >
              {p.label}
            </span>
          ))}
          {town.npcs.map((n, k) => {
            const h = npcH(n.npc), w = h * npcRatio(n.npc as NpcName);
            return (
              <div key={k} className="pointer-events-none absolute" style={{ left: (n.x - w / 2) * SCALE, top: (n.y - h * NPC_FEET) * SCALE, width: w * SCALE, zIndex: zOf(n.y / UNIT) }}>
                <Npc name={n.npc as NpcName} facing={n.facing} still className="w-full" />
                <span className="absolute left-1/2 top-[-4px] -translate-x-1/2 -translate-y-full whitespace-nowrap bg-ink px-1.5 text-[clamp(10px,1.6cqw,18px)] uppercase text-paper">{TAG[n.action as Talk] ?? ""}</span>
              </div>
            );
          })}
          <div ref={marker} className="marker pointer-events-none absolute z-[5] h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-gold opacity-0" />
          {remote.map((r) => <Figure key={r.id} id={r.id} sprite={r.sprite} role={r.role} level={r.level} tag={r.lead ? r.name : null} own={false} rig={rig} join={r.lead && recruiting.has(r.uid) ? () => openPartyPanel(recruiting.get(r.uid)) : undefined} />)}
          {mine.map((f, i) => <Figure key={f.id} id={f.id} sprite={f.template.sprite_key} role={f.template.role} level={f.level} tag={i === 0 ? "You" : null} own rig={rig} />)}
        </div>
      </div>

      {tour && <LobbyTour />}
      {talk && (
        <Speech npc={SPEAKER[talk]} title={TITLE[talk]} wide={talk === "storage" || talk === "boss"} shop={talk === "merchant" || talk === "armourer" || talk === "blacksmith" || talk === "carpenter" || talk === "alchemist" || talk === "classes"} onClose={close}>
          {talk === "arena" && (
            <>
              <p>Think your fighters are tough? Test them against other guilds.</p>
              <SpeechActions>
                <Link href="/arena"><PixelButton className="w-full">Enter the arena</PixelButton></Link>
                <PixelButton variant="ghost" onClick={close}>Not now</PixelButton>
              </SpeechActions>
            </>
          )}
          {(talk === "challenge" || talk === "boss" || talk === "raid") && <ArenaStation station={talk} />}
          {talk === "classes" && (
            <ClassChangerPanel />
          )}
          {talk === "alchemist" && (
            <>
              <p className="text-steel">Bring me monster parts and I&apos;ll brew potions, or buy the parts off you.</p>
              <AlchemistPanel />
              <SpeechActions><PixelButton variant="ghost" onClick={close}>Done</PixelButton></SpeechActions>
            </>
          )}
          {talk === "storage" && (
            <>
              <p className="text-steel">Keep your spare items safe in a box with more room than your bag.</p>
              <StoragePanel />
            </>
          )}
          {talk === "merchant" && (
            <>
              <p className="text-steel">Potions bought and sold here. Fighters and gear are coming soon.</p>
              <MarketPanel />
              <SpeechActions><PixelButton variant="ghost" onClick={close}>Done</PixelButton></SpeechActions>
            </>
          )}
          {talk === "armourer" && (
            <>
              <p className="text-steel">Weapons, shields and armour sets. Higher ranks need a higher level, and each set is made for one class.</p>
              <ArmouryPanel />
              <SpeechActions><PixelButton variant="ghost" onClick={close}>Done</PixelButton></SpeechActions>
            </>
          )}
          {talk === "blacksmith" && (
            <>
              <p className="text-steel">Bring me your gear. I can make a piece stronger with coins, and once it is level 10, forge it into the next rank.</p>
              <ForgePanel />
              <SpeechActions><PixelButton variant="ghost" onClick={close}>Done</PixelButton></SpeechActions>
            </>
          )}
          {talk === "carpenter" && (
            <>
              <CarpenterPanel />
              <SpeechActions><PixelButton variant="ghost" onClick={close}>Done</PixelButton></SpeechActions>
            </>
          )}
          {talk === "guard" && (
            <>
              <p>The guild hall is just through here. Need to head back?</p>
              <SpeechActions>
                <Link href="/home"><PixelButton className="w-full">Back to the guild</PixelButton></Link>
                <PixelButton variant="ghost" onClick={close}>Stay here</PixelButton>
              </SpeechActions>
            </>
          )}
        </Speech>
      )}
    </div>
  );
}

/** The name floating over each person, so everyone is clear who they are. */
const TAG: Record<Talk, string> = {
  arena: "Arena Master", challenge: "Challenge Master", boss: "Boss Rush Master", raid: "Floor Raid Master", classes: "Class Changer", alchemist: "Alchemist", storage: "Storage Keeper", merchant: "Item Seller", armourer: "Armourer", blacksmith: "Blacksmith", carpenter: "Carpenter", guard: "Guild Guard",
};
const TITLE: Record<Talk, string> = {
  arena: "The Arena", challenge: "Challenge", boss: "Boss Rush", raid: "Floor Raid", classes: "Class Changer", alchemist: "Alchemist", storage: "Storage", merchant: "Marketplace", armourer: "Armourer", blacksmith: "Blacksmith", carpenter: "Carpenter", guard: "Guild Guard",
};
