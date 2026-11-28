"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getChatSocket } from "@/lib/socket";
import { partyActions, releaseSocial, retainSocial, useSocial } from "@/lib/social";
import { PartyPanel } from "./PartyPanel";

type Scope = "world" | "room" | "party" | "whisper";
interface Msg { id: string; s: Scope; from: string; to?: string; text: string; t: number }

const TABS: { id: Scope; label: string }[] = [{ id: "world", label: "World" }, { id: "room", label: "Room" }, { id: "party", label: "Party" }, { id: "whisper", label: "Whisper" }];
const MAX_KEEP = 150;
const MAX_LEN = 160;
const ERRORS: Record<string, string> = {
  no_room: "Enter the lobby or a floor to use Room chat.", no_such_player: "No player has that name.", offline: "They're offline right now.",
  slow: "Slow down a little.", dup: "You just said that.", self: "That's you!", no_name: "Pick a guild-master name to chat.",
  no_party: "Join a party first.", empty: "Type something first.", no_target: "Choose who to whisper to.", failed: "Couldn't send. Try again.", bad_request: "Couldn't send. Try again.",
};
const same = (a?: string, b?: string) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** A small pixel speech bubble (no art sheet cell for it yet). */
function BubbleIcon() {
  return (
    <svg viewBox="0 0 16 16" width="22" height="22" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M2 2h12v9H8l-3 3v-3H2z" fill="currentColor" />
      <path d="M4 5h8v1H4zM4 7h5v1H4z" fill="#1a1c2c" />
    </svg>
  );
}

/** Two little figures: the party button. */
function PartyIcon() {
  return (
    <svg viewBox="0 0 16 16" width="20" height="20" shapeRendering="crispEdges" aria-hidden="true">
      <path d="M3 3h4v4H3zM9 4h4v4H9zM1 9h8v5H1zM8 10h7v4H8z" fill="currentColor" />
    </svg>
  );
}

/**
 * Chat and parties for the whole game, tucked behind a small icon at the top right. World reaches everyone online, Room everyone in your lobby or floor room,
 * Whisper one player by name. Tapping anywhere outside it folds it away; a dot on the icon shows what you missed (red for whispers).
 */
export function ChatDock() {
  const [status, setStatus] = useState<"connecting" | "on" | "off">("connecting");
  const [me, setMe] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Scope>("world");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [unread, setUnread] = useState<Record<Scope, number>>({ world: 0, room: 0, party: 0, whisper: 0 });
  const [view, setView] = useState<"chat" | "party">("chat");
  const [focusId, setFocusId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const social = useSocial();
  const [target, setTarget] = useState<string | null>(null);
  const [mates, setMates] = useState<string[] | null>(null);
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [typed, setTyped] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const live = useRef({ open, tab, me, view });
  useEffect(() => { live.current = { open, tab, me, view }; });

  useEffect(() => {
    const sock = getChatSocket();
    const onReady = (r: { name: string | null }) => { setMe(r.name); setStatus("on"); };
    const onMsg = (m: Msg) => {
      setMsgs((p) => [...p, m].slice(-MAX_KEEP));
      const { open: o, tab: t, me: mine, view: v } = live.current;
      if (same(m.from, mine ?? undefined)) return;
      if (!o || v !== "chat" || t !== m.s) setUnread((u) => ({ ...u, [m.s]: u[m.s] + 1 }));
    };
    const onFail = () => setStatus("off");
    sock.on("ready", onReady); sock.on("msg", onMsg); sock.on("connect_error", onFail);
    retainSocial();
    return () => { sock.off("ready", onReady); sock.off("msg", onMsg); sock.off("connect_error", onFail); releaseSocial(); };
  }, []);

  // The room button (and the join icon over a recruiting player) opens the party panel.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<{ join?: string }>).detail?.join ?? null;
      setView("party"); setOpen(true); setFocusId(id);
      if (id) {
        const n = social.nearby.find((x) => x.id === id);
        if (n?.open) void partyActions.join(id).then((r) => { if (r.error) setNote(null); });
      }
    };
    window.addEventListener("party:open", onOpen);
    return () => window.removeEventListener("party:open", onOpen);
  });
  // A line about what happened to the party (someone joined, you were removed...) shows for a few seconds.
  const noteAt = social.note?.at;
  useEffect(() => {
    if (!social.note) return;
    const show = setTimeout(() => setToast(social.note!.text), 0), hide = setTimeout(() => setToast(null), 4500);
    return () => { clearTimeout(show); clearTimeout(hide); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteAt]);
  useEffect(() => { if (!social.party && tab === "party") { const t = setTimeout(() => setTab("world"), 0); return () => clearTimeout(t); } }, [social.party, tab]);

  // Tapping away from the chat folds it. The tap still reaches the game underneath.
  useEffect(() => {
    if (!open) return;
    const away = (e: Event) => { if (root.current && !root.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", away, true);
    return () => document.removeEventListener("pointerdown", away, true);
  }, [open]);

  const refreshMates = useCallback(() => {
    getChatSocket().timeout(3000).emit("who", {}, (err: unknown, r?: { room: string[] | null }) => setMates(err ? null : r?.room ?? null));
  }, []);
  useEffect(() => { if (open && tab === "whisper") { const t = setTimeout(refreshMates, 0); return () => clearTimeout(t); } }, [open, tab, refreshMates]);

  const shown = useMemo(() => msgs.filter((m) => m.s === tab && (tab !== "whisper" || (target && (same(m.from, target) || same(m.to, target))))), [msgs, tab, target]);
  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight }); }, [shown.length, open, tab, target]);

  const recent = useMemo(() => {
    const out: string[] = [];
    for (const m of [...msgs].reverse()) {
      if (m.s !== "whisper") continue;
      const other = same(m.from, me ?? undefined) ? m.to : m.from;
      if (other && !out.some((o) => same(o, other))) out.push(other);
    }
    return out.slice(0, 6);
  }, [msgs, me]);

  const pick = (s: Scope) => {
    setView("chat");
    setTab(s); setNote(null);
    setUnread((u) => ({ ...u, [s]: 0 }));
  };
  const toggle = () => { if (open && view === "chat") { setOpen(false); return; } setView("chat"); setOpen(true); setNote(null); setUnread((u) => ({ ...u, [tab]: 0 })); };
  const toggleParty = () => { if (open && view === "party") { setOpen(false); return; } setView("party"); setOpen(true); setFocusId(null); };
  const whisperTo = (name: string) => { setView("chat"); setTarget(name); setTyped(""); setTab("whisper"); setOpen(true); setNote(null); setUnread((u) => ({ ...u, whisper: 0 })); };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    if (tab === "whisper" && !target) { setNote(ERRORS.no_target); return; }
    getChatSocket().timeout(5000).emit("say", { scope: tab, text: body, ...(tab === "whisper" ? { to: target } : {}) }, (err: unknown, r?: { ok?: boolean; error?: string }) => {
      if (err || !r) return setNote("No connection. Try again.");
      if (r.error) return setNote(ERRORS[r.error] ?? ERRORS.failed);
      setNote(null); setText("");
    });
  };

  if (status === "off") return null;
  const dot = unread.whisper > 0 ? "bg-ember" : unread.world + unread.room + unread.party > 0 ? "bg-gold" : "";
  const total = unread.world + unread.room + unread.party + unread.whisper;
  const tabs = TABS.filter((t) => t.id !== "party" || social.party);
  const chatOpen = open && view === "chat", partyOpen = open && view === "party";

  return (
    <div ref={root} className="pointer-events-none fixed right-2 top-2 z-[9650] flex flex-col items-end gap-1 pt-[env(safe-area-inset-top)] short:top-1">
      <button
        type="button" onClick={toggle} aria-label={chatOpen ? "Close chat" : total ? `Open chat, ${total} unread` : "Open chat"} aria-expanded={chatOpen}
        className={`pointer-events-auto pixel-box relative flex h-10 w-10 items-center justify-center ${chatOpen ? "bg-gold text-ink" : "bg-night/95 text-paper"} short:h-9 short:w-9`}
      >
        <BubbleIcon />
        {!chatOpen && dot && <span className={`absolute -right-1 -top-1 min-w-4 px-1 text-center text-xs leading-4 text-ink ${dot}`}>{total > 9 ? "9+" : total}</span>}
      </button>

      {social.party && (
        <button type="button" onClick={toggleParty} aria-label={`Party, ${social.party.members.length} of 4`} aria-expanded={partyOpen}
          className={`pointer-events-auto pixel-box flex h-8 items-center gap-1 px-2 text-base ${partyOpen ? "bg-gold text-ink" : "bg-night/95 text-paper"}`}>
          <PartyIcon />{social.party.members.length}/4
        </button>
      )}
      {toast && !partyOpen && <p role="status" className="pointer-events-none pixel-box max-w-[14rem] bg-night/95 px-2 py-1 text-sm text-paper">{toast}</p>}

      {partyOpen && (
        <section aria-label="Party" className="pointer-events-auto pixel-box card-reveal flex max-h-[min(24rem,62dvh)] w-[min(calc(100vw-1rem),21rem)] flex-col bg-night/95 short:max-h-[78dvh]">
          <div className="flex shrink-0 items-center justify-between border-b-2 border-steel/40 px-2 py-1.5">
            <p className="text-base uppercase text-gold">{social.party ? "Your party" : "Party"}</p>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="px-1 text-lg leading-5 text-steel">×</button>
          </div>
          <PartyPanel party={social.party} nearby={social.nearby} level={social.level} me={social.uid} focusId={focusId} />
        </section>
      )}

      {chatOpen && (
        <section aria-label="Chat" className="pointer-events-auto pixel-box card-reveal flex h-[min(22rem,52dvh)] w-[min(calc(100vw-1rem),21rem)] flex-col bg-night/95 short:h-[min(13rem,72dvh)]">
          <div role="tablist" className="flex shrink-0 border-b-2 border-steel/40">
            {tabs.map((t) => (
              <button
                key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => pick(t.id)}
                className={`relative flex-1 px-1 py-1.5 text-base uppercase leading-4 ${tab === t.id ? "bg-gold text-ink" : "text-paper"}`}
              >
                {t.label}
                {tab !== t.id && unread[t.id] > 0 && <span className={`absolute right-1 top-1 h-2 w-2 ${t.id === "whisper" ? "bg-ember" : "bg-gold"}`} aria-label="New messages" />}
              </button>
            ))}
          </div>

          {tab === "whisper" && !target ? (
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              <p className="text-base text-paper">Whisper to…</p>
              <form className="flex gap-1" onSubmit={(e) => { e.preventDefault(); if (typed.trim()) whisperTo(typed.trim()); }}>
                <input value={typed} onChange={(e) => setTyped(e.target.value)} maxLength={32} placeholder="Player name" aria-label="Player name" autoComplete="off" autoCapitalize="off" className="min-w-0 flex-1 bg-ink px-2 py-1.5 text-base text-paper outline-none placeholder:text-steel focus:ring-2 focus:ring-gold" />
                <button type="submit" disabled={!typed.trim()} className="pixel-btn shrink-0 bg-gold px-3 text-base uppercase text-ink disabled:opacity-50">Go</button>
              </form>
              {mates && mates.length > 0 && <Chips title="In your room" names={mates} onPick={whisperTo} />}
              {recent.length > 0 && <Chips title="Recent" names={recent} onPick={whisperTo} />}
              {(!mates || mates.length === 0) && recent.length === 0 && <p className="text-sm text-steel">Type a player&apos;s name, or tap a name in World or Room chat.</p>}
            </div>
          ) : (
            <>
              {tab === "whisper" && target && (
                <div className="flex shrink-0 items-center gap-2 bg-ink/60 px-2 py-1 text-base">
                  <button type="button" onClick={() => { setTarget(null); setNote(null); }} aria-label="Pick someone else" className="text-gold">‹</button>
                  <span className="min-w-0 flex-1 truncate text-paper">To <span className="text-gold">{target}</span></span>
                </div>
              )}
              <div ref={list} className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 py-1.5" role="log" aria-live="polite">
                {shown.length === 0 ? (
                  <p className="text-sm text-steel">
                    {tab === "world" ? "Everyone online can see this." : tab === "room" ? "Only people in this lobby or room can see this." : tab === "party" ? "Only your party can see this." : `Say hi to ${target}.`}
                  </p>
                ) : shown.map((m) => {
                  const mine = same(m.from, me ?? undefined);
                  return (
                    <p key={m.id} className="break-words text-base leading-5 text-paper">
                      {mine ? <span className="text-leaf">You</span> : (
                        <button type="button" onClick={() => whisperTo(m.from)} className={`${m.s === "whisper" ? "text-ember" : m.s === "room" ? "text-sky" : m.s === "party" ? "text-leaf" : "text-gold"} underline-offset-2 hover:underline`}>{m.from}</button>
                      )}
                      <span className="text-steel">: </span>{m.text}
                    </p>
                  );
                })}
              </div>
              {note && <p role="alert" className="shrink-0 px-2 pb-1 text-sm text-ember">{note}</p>}
              <form className="flex shrink-0 gap-1 border-t-2 border-steel/40 p-1.5" onSubmit={(e) => { e.preventDefault(); send(); }}>
                <input
                  value={text} onChange={(e) => setText(e.target.value)} maxLength={MAX_LEN} enterKeyHint="send" autoComplete="off"
                  placeholder={tab === "world" ? "Message the world" : tab === "room" ? "Message the room" : tab === "party" ? "Message your party" : `Message ${target}`} aria-label="Message"
                  className="min-w-0 flex-1 bg-ink px-2 py-1.5 text-base text-paper outline-none placeholder:text-steel focus:ring-2 focus:ring-gold"
                />
                <button type="submit" disabled={!text.trim() || status !== "on"} className="pixel-btn shrink-0 bg-gold px-3 text-base uppercase text-ink disabled:opacity-50">Send</button>
              </form>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function Chips({ title, names, onPick }: { title: string; names: string[]; onPick: (n: string) => void }) {
  return (
    <div>
      <p className="mb-1 text-sm uppercase text-steel">{title}</p>
      <div className="flex flex-wrap gap-1">
        {names.map((n) => <button key={n} type="button" onClick={() => onPick(n)} className="max-w-full truncate bg-panel px-2 py-1 text-base text-paper hover:bg-gold hover:text-ink">{n}</button>)}
      </div>
    </div>
  );
}
