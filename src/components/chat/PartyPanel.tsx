"use client";

import { useMemo, useState } from "react";
import { ARCHETYPE_LABEL } from "@/lib/guild";
import { partyActions, type Invite, type Nearby, type PartyAck, type PartyRules, type PartyView } from "@/lib/social";

const ERR: Record<string, (a: PartyAck, level: number) => string> = {
  in_party: () => "You're already in a party.", no_such: () => "That party isn't recruiting any more.", full: () => "That party is full.", closed: () => "That party isn't taking members right now.",
  wrong_password: () => "Wrong password.", bad_range: () => "Pick a level range from 1 to 99.", bad_password: () => "A locked party needs a password.", not_host: () => "Only the host can do that.",
  level_low: (a, l) => `You can't join: this party needs level ${a.min}–${a.max} and you're level ${l}.`, level_high: (a, l) => `You can't join: this party needs level ${a.min}–${a.max} and you're level ${l}.`,
  failed: () => "No connection. Try again.", not_here: () => "They've left the room.", target_in_party: () => "They're already in a party.", offline: () => "They're offline.",
  slow: () => "You just invited them. Give them a moment.", invite_gone: () => "That invitation has run out.", no_target: () => "Pick someone else.",
};
const say = (a: PartyAck, level: number) => (a.error ? (ERR[a.error] ?? ERR.failed)(a, level) : null);

function LockIcon() {
  return <svg viewBox="0 0 8 8" width="12" height="12" shapeRendering="crispEdges" aria-label="Locked" className="inline-block text-steel"><path d="M2 3V2a2 2 0 0 1 4 0v1h1v5H1V3zm1 0h2V2a1 1 0 0 0-2 0z" fill="currentColor" /></svg>;
}

/** Open or locked, a password (10 letters at most) and a level range. Used to start a party and to edit one. */
function RulesForm({ initial, level, submit, busy, onSubmit }: { initial?: PartyRules; level: number; submit: string; busy: boolean; onSubmit: (r: PartyRules) => void }) {
  const [open, setOpen] = useState(initial?.open ?? true);
  const [pw, setPw] = useState(initial?.password ?? "");
  const [min, setMin] = useState(String(initial?.min ?? Math.max(1, level - 5)));
  const [max, setMax] = useState(String(initial?.max ?? Math.min(99, level + 5)));
  const lo = parseInt(min, 10), hi = parseInt(max, 10);
  const bad = !(lo >= 1 && hi <= 99 && lo <= hi) || (!open && pw.trim().length === 0);
  const num = "w-14 bg-ink px-1 py-1 text-center text-base text-paper outline-none focus:ring-2 focus:ring-gold";
  return (
    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (!bad) onSubmit({ open, password: open ? undefined : pw, min: lo, max: hi }); }}>
      <div role="radiogroup" aria-label="Who can join" className="flex">
        {([[true, "Open"], [false, "Locked"]] as const).map(([v, t]) => (
          <button key={t} type="button" role="radio" aria-checked={open === v} onClick={() => setOpen(v)} className={`flex-1 py-1.5 text-base uppercase ${open === v ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{t}</button>
        ))}
      </div>
      {!open && (
        <input value={pw} onChange={(e) => setPw(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10))} maxLength={10} placeholder="Password (10 max)" aria-label="Password" autoComplete="off" autoCapitalize="off"
          className="w-full bg-ink px-2 py-1.5 text-base text-paper outline-none placeholder:text-steel focus:ring-2 focus:ring-gold" />
      )}
      <p className="text-sm uppercase text-steel">Set the party level requirements</p>
      <div className="flex items-center gap-1.5 text-base text-paper">
        <span className="text-steel">Level</span>
        <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" aria-label="Lowest level" className={num} />
        <span className="text-steel">to</span>
        <input value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, "").slice(0, 2))} inputMode="numeric" aria-label="Highest level" className={num} />
      </div>
      <button type="submit" disabled={bad || busy} className="pixel-btn w-full bg-gold py-1.5 text-base uppercase text-ink disabled:opacity-50">{submit}</button>
    </form>
  );
}

function InviteBox({ inv, busy, onAnswer }: { inv: Invite; busy: boolean; onAnswer: (accept: boolean) => void }) {
  const names = [...new Set(inv.classes.map((c) => ARCHETYPE_LABEL[c.archetype] ?? c.archetype))];
  return (
    <li className="space-y-1.5 border-2 border-gold bg-panel p-2">
      <p className="text-base leading-5 text-paper"><span className="text-gold">{inv.name}</span> invited you to a party</p>
      <p className="text-sm leading-4 text-steel">Level {inv.level}{names.length > 0 && <> · {names.join(", ")}</>}</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" disabled={busy} onClick={() => onAnswer(true)} className="pixel-btn bg-leaf py-1 text-base uppercase text-ink disabled:opacity-50">Accept</button>
        <button type="button" disabled={busy} onClick={() => onAnswer(false)} className="pixel-btn bg-panel py-1 text-base uppercase text-paper disabled:opacity-50">Decline</button>
      </div>
    </li>
  );
}

function Row({ n, level, focus, onJoin, busy }: { n: Nearby; level: number; focus: boolean; onJoin: (id: string, pw?: string) => void; busy: boolean }) {
  const [asking, setAsking] = useState(focus);
  const [pw, setPw] = useState("");
  return (
    <li className="bg-panel p-1.5">
      <div className="flex items-center gap-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base leading-4 text-paper">{n.hostName}</span>
          <span className={`block text-sm leading-4 ${n.fits ? "text-steel" : "text-ember"}`}>{n.n}/4 · Lv {n.min}–{n.max} {!n.open && <LockIcon />}</span>
        </span>
        <button type="button" disabled={busy} onClick={() => (n.open || asking ? onJoin(n.id, pw) : setAsking(true))} className="pixel-btn shrink-0 bg-gold px-3 py-1 text-base uppercase text-ink disabled:opacity-50">{asking && !n.open ? "Go" : "Join"}</button>
      </div>
      {asking && !n.open && (
        <input value={pw} onChange={(e) => setPw(e.target.value.replace(/[^A-Za-z0-9]/g, "").slice(0, 10))} maxLength={10} placeholder="Password" aria-label="Party password" autoComplete="off" autoCapitalize="off"
          onKeyDown={(e) => { if (e.key === "Enter") onJoin(n.id, pw); }}
          className="mt-1.5 w-full bg-ink px-2 py-1.5 text-base text-paper outline-none placeholder:text-steel focus:ring-2 focus:ring-gold" />
      )}
      {!n.fits && <p className="mt-1 text-sm text-steel">Needs level {n.min}–{n.max} (you&apos;re {level}).</p>}
    </li>
  );
}

export function PartyPanel({ party, nearby, level, me, focusId, invites }: { party: PartyView | null; nearby: Nearby[]; level: number; me: string | null; focusId: string | null; invites: Invite[] }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const run = async (f: () => Promise<PartyAck>, after?: () => void) => {
    setBusy(true); setMsg(null);
    const r = await f();
    setBusy(false);
    const m = say(r, level);
    if (m) setMsg(m); else after?.();
  };
  const isHost = !!party && party.host === me;
  const rank = useMemo(() => [...nearby].sort((a, b) => Number(b.fits) - Number(a.fits)), [nearby]);

  if (!party) {
    return (
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-2">
        {invites.length > 0 && (
          <section aria-label="Invitations">
            <p className="mb-1 text-sm uppercase text-gold">Invitations</p>
            <ul className="space-y-1.5">{invites.map((i) => <InviteBox key={i.from} inv={i} busy={busy} onAnswer={(ok) => run(() => (ok ? partyActions.accept(i.from) : partyActions.decline(i.from)))} />)}</ul>
          </section>
        )}
        <section aria-label="Parties recruiting here">
          <p className="mb-1 text-sm uppercase text-steel">Recruiting here</p>
          {rank.length === 0 ? <p className="text-base text-steel">No one here is recruiting. Start your own below.</p> : (
            <ul className="space-y-1">{rank.map((n) => <Row key={n.id} n={n} level={level} focus={focusId === n.id} busy={busy} onJoin={(id, pw) => run(() => partyActions.join(id, pw))} />)}</ul>
          )}
        </section>
        <section aria-label="Start a party">
          <p className="mb-1 text-sm uppercase text-steel">Start a party</p>
          <RulesForm level={level} busy={busy} submit="Start party" onSubmit={(r) => run(() => partyActions.create(r))} />
        </section>
        {msg && <p role="alert" className="text-sm text-ember">{msg}</p>}
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
      <ul className="space-y-1" aria-label="Party members">
        {party.members.map((m) => (
          <li key={m.uid} className="flex items-center gap-2 bg-panel px-2 py-1.5">
            <span className="min-w-0 flex-1 truncate text-base text-paper">{m.uid === party.host && <span className="mr-1 text-gold" title="Host">♛</span>}{m.name}{m.uid === me && <span className="text-steel"> (you)</span>}</span>
            <span className="shrink-0 text-sm text-steel">Lv {m.level}</span>
            {isHost && m.uid !== me && <button type="button" disabled={busy} onClick={() => run(() => partyActions.kick(m.uid))} aria-label={`Remove ${m.name}`} className="shrink-0 px-1.5 text-lg leading-5 text-ember">×</button>}
          </li>
        ))}
        {Array.from({ length: 4 - party.members.length }, (_, i) => <li key={`e${i}`} className="border-2 border-dashed border-steel/40 px-2 py-1.5 text-base text-steel">Open slot</li>)}
      </ul>

      <p className="text-sm text-steel">
        {party.recruiting && !party.full ? <>Recruiting · Lv {party.min}–{party.max} · {party.open ? "open" : <>password <span className="text-gold">{isHost ? party.password : "set"}</span></>}</> : party.full ? "Party full" : "Not recruiting"}
        {!isHost && party.room && <><br />Host is {party.room.floor === 0 ? "in the Main Lobby" : party.room.floor < 0 ? "in the Training Ground" : `on Floor ${party.room.floor}`} · room {party.room.code}</>}
      </p>
      <p className="text-sm text-steel">Kill experience is shared with party members in the same room. Drops go to one of them, picked by who did the most damage.</p>

      {isHost && editing && (
        <RulesForm initial={{ open: party.open, password: party.password, min: party.min, max: party.max }} level={level} busy={busy} submit="Save rules"
          onSubmit={(r) => run(() => partyActions.edit({ ...r, recruiting: party.recruiting }), () => setEditing(false))} />
      )}
      {isHost && !editing && (
        <div className="grid grid-cols-2 gap-1.5">
          <button type="button" disabled={busy || party.full} onClick={() => run(() => partyActions.edit({ open: party.open, password: party.password, min: party.min, max: party.max, recruiting: !party.recruiting }))} className="pixel-btn bg-panel py-1.5 text-base uppercase text-paper disabled:opacity-50">{party.recruiting ? "Put down request" : "Open request"}</button>
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className="pixel-btn bg-panel py-1.5 text-base uppercase text-paper">Edit rules</button>
        </div>
      )}
      {isHost ? (
        <button type="button" disabled={busy} onClick={() => (confirm ? run(() => partyActions.disband()) : setConfirm(true))} onBlur={() => setConfirm(false)} className="pixel-btn w-full bg-ember py-1.5 text-base uppercase text-ink disabled:opacity-50">{confirm ? "Tap again to disband" : "Disband party"}</button>
      ) : (
        <button type="button" disabled={busy} onClick={() => run(() => partyActions.leave())} className="pixel-btn w-full bg-panel py-1.5 text-base uppercase text-paper disabled:opacity-50">Leave party</button>
      )}
      {isHost && <button type="button" disabled={busy} onClick={() => run(() => partyActions.leave())} className="w-full text-sm text-steel underline">Leave and hand the party on</button>}
      {msg && <p role="alert" className="text-sm text-ember">{msg}</p>}
    </div>
  );
}
