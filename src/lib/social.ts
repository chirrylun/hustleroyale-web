"use client";

import { useSyncExternalStore } from "react";
import { getChatSocket } from "@/lib/socket";

export interface PartyMemberView { uid: string; name: string; level: number }
export interface PartyView {
  id: string; host: string; members: PartyMemberView[]; open: boolean; min: number; max: number; recruiting: boolean; full: boolean;
  /** Only the host is sent the password. */
  password?: string;
  /** Where the host is right now (a floor or the lobby, with the room code), so members can find them. */
  room: { floor: number; code: string } | null;
}
export interface Nearby { id: string; host: string; hostName: string; n: number; open: boolean; min: number; max: number; fits: boolean }
export interface PartyRules { open: boolean; password?: string; min: number; max: number; recruiting?: boolean }
export interface PartyAck { ok?: boolean; error?: string; min?: number; max?: number; party?: PartyView }

interface Snapshot { uid: string | null; party: PartyView | null; nearby: Nearby[]; level: number; note: { text: string; at: number } | null }

let snap: Snapshot = { uid: null, party: null, nearby: [], level: 1, note: null };
let holders = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const subs = new Set<() => void>();
const set = (next: Partial<Snapshot>) => { snap = { ...snap, ...next }; subs.forEach((f) => f()); };

const onParty = (r: { party: PartyView | null; note?: string }) => set({ party: r.party, ...(r.note ? { note: { text: r.note, at: Date.now() } } : {}) });

/** Ask the server where our party and the recruiting parties around us stand. */
export function syncParty() {
  const sock = getChatSocket();
  if (!sock.connected) return;
  sock.timeout(4000).emit("party:sync", {}, (err: unknown, r?: { uid: string; party: PartyView | null; nearby: Nearby[]; level: number }) => {
    if (err || !r) return;
    set({ uid: r.uid, party: r.party, nearby: r.nearby, level: r.level });
  });
}

/** Keep the shared connection open (chat and parties use one). Pair every `retainSocial` with a `releaseSocial`. */
export function retainSocial() {
  if (holders++ > 0) return;
  const sock = getChatSocket();
  sock.on("party", onParty);
  sock.on("connect", syncParty);
  sock.connect();
  timer = setInterval(() => { if (typeof document === "undefined" || !document.hidden) syncParty(); }, 5000);
}
export function releaseSocial() {
  if (--holders > 0) return;
  holders = 0;
  const sock = getChatSocket();
  sock.off("party", onParty);
  sock.off("connect", syncParty);
  sock.disconnect();
  if (timer) clearInterval(timer);
  timer = null;
  snap = { uid: null, party: null, nearby: [], level: 1, note: null };
}

function call(event: string, payload: unknown = {}): Promise<PartyAck> {
  return new Promise((resolve) => {
    getChatSocket().timeout(5000).emit(event, payload, (err: unknown, r?: PartyAck) => {
      const res = err || !r ? { error: "failed" } : r;
      if (res.party !== undefined) set({ party: res.party });
      if (res.ok || res.error) setTimeout(syncParty, 0);
      resolve(res);
    });
  });
}

export const partyActions = {
  create: (rules: PartyRules) => call("party:create", rules),
  join: (id: string, password?: string) => call("party:join", { id, password }),
  edit: (rules: PartyRules) => call("party:edit", rules),
  leave: () => call("party:leave"),
  kick: (uid: string) => call("party:kick", { uid }),
  disband: () => call("party:disband"),
};

const subscribe = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
const empty: Snapshot = { uid: null, party: null, nearby: [], level: 1, note: null };
/** The party you are in, the parties recruiting in your room, and your own level for the rules. */
export function useSocial(): Snapshot { return useSyncExternalStore(subscribe, () => snap, () => empty); }

/** Open the party panel (the room button does this), optionally on a recruiting party (the join icon over a player's head does this). */
export function openPartyPanel(join?: string) { window.dispatchEvent(new CustomEvent("party:open", { detail: { join } })); }
