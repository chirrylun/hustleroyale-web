"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PixelButton } from "@/components/pixel/PixelButton";
import { Speech, SpeechActions } from "@/components/room/Speech";
import { ARCHETYPE_LABEL, RECRUITS, RANK_LEVEL, isRecruit } from "@/lib/guild";
import { itemName } from "@/lib/items";
import { createClient } from "@/lib/supabase/client";
import { NPC_TAG, TRAINING_DONE, type TrainingNpc } from "@/lib/training";
import type { Role } from "@/lib/starter-pack";

export interface Reward { step: number; coins: number; xp: number; items: { slug: string; qty: number }[]; armor: unknown[] }
interface Mate { id: string; name: string; level: number; archetype: string; role: Role }
const SPEAKER = { manager: "manager", trainer: "trainer", changer: "class_changer" } as const;

/** What a person in the training field says. The database decides whether a step is really done (training_advance); this only words it. */
export function TrainingTalk({ npc, step, kills, lowest, total, potionSet, onStep, onClassChanged, onClose }: {
  npc: TrainingNpc; step: number; kills: number; lowest: number; total: number; potionSet: boolean;
  onStep: (r: Reward) => void; onClassChanged: () => void; onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [got, setGot] = useState<Reward | null>(null);
  const cur = got?.step ?? step;

  const advance = async (flagPotion = false) => {
    if (busy) return;
    setBusy(true); setNote(null);
    const sb = createClient();
    if (flagPotion) await sb.rpc("training_flag_potion");
    const { data, error } = await sb.rpc("training_advance");
    setBusy(false);
    if (error) { setNote(error.message.includes("training_not_ready") ? "Not quite yet. Check the goal along the top of the screen." : "That didn't work. Try again."); return; }
    const r = data as Reward;
    setGot(r); onStep(r);
    if (r.step === TRAINING_DONE) router.push("/lobby?tour=1");
  };

  const rewardLine = got && (got.coins || got.xp || got.items.length > 0 || got.armor.length > 0) ? (
    <p className="pixel-box bg-panel p-2 text-lg text-leaf">
      Reward:{got.coins ? ` ${got.coins} coins` : ""}{got.xp ? `, experience for every fighter` : ""}
      {got.items.length > 0 && `, ${got.items.map((i) => `${i.qty} × ${itemName(i.slug)}`).join(", ")}`}
      {got.armor.length > 0 && `, Recruit armour for every fighter (already worn)`}.
    </p>
  ) : null;

  const close = () => onClose();
  const done = <SpeechActions><PixelButton onClick={close}>Got it</PixelButton></SpeechActions>;

  if (npc === "changer") return <Speech npc="class_changer" title={NPC_TAG.changer} onClose={close}><ChangerBody step={step} onClassChanged={onClassChanged} onClose={close} /></Speech>;

  if (npc === "manager") {
    return (
      <Speech npc="manager" title={NPC_TAG.manager} onClose={close}>
        {cur === 0 && (<>
          <p>Welcome to the training field! This is where you learn to get started before you take on the real world.</p>
          <p className="text-steel">Go and speak to the <span className="text-gold">Trainer</span>, the soldier with the spear. He will set you a few tasks.</p>
          <SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Understood</PixelButton></SpeechActions>
        </>)}
        {cur >= 1 && cur <= 5 && (<><p>Speak to the Trainer and finish his tasks. Come back to me when he says you are done.</p>{done}</>)}
        {cur === 6 && (<>
          <p>Excellent work! You are ready for the real thing. Come, I will take you to the Main Lobby and show you around.</p>
          <SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Take me to the lobby</PixelButton><PixelButton variant="ghost" onClick={close}>Not yet</PixelButton></SpeechActions>
        </>)}
        {note && <p role="alert" className="text-lg text-ember">{note}</p>}
      </Speech>
    );
  }

  return (
    <Speech npc="trainer" title={NPC_TAG.trainer} onClose={close}>
      {rewardLine}
      {cur === 0 && (<><p>Hold on there. The Guild Manager wants a word with you first.</p>{done}</>)}
      {cur === 1 && (<>
        <p>So you are the new recruits. I am the Trainer. I will get you ready.</p>
        <p><span className="text-gold">Quest 1: First Blood.</span> Defeat a slime. Tap one and your fighters will attack it. They won&apos;t hit back until you do.</p>
        <SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Accept quest</PixelButton></SpeechActions>
      </>)}
      {cur === 2 && (kills < 1
        ? (<><p><span className="text-gold">Quest 1: First Blood.</span> Defeat a slime. Tap one to send your party at it.</p>{done}</>)
        : (<><p>You did it! Your first monster, your first quest.</p><SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Claim reward</PixelButton></SpeechActions></>))}
      {cur === 3 && (lowest < 5 && !got
        ? (<><p><span className="text-gold">Quest 2: Grow Stronger.</span> Fight slimes until every fighter reaches level 5.</p><p className="text-steel">Open the Fighters button on the left to see each level.</p>{done}</>)
        : got
          ? (<><p><span className="text-gold">Quest 2: Grow Stronger.</span> Fight slimes until every fighter reaches level 5.</p>{done}</>)
          : (<><p>Level 5 already. Well done!</p><SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>Claim reward</PixelButton></SpeechActions></>))}
      {cur === 4 && (!potionSet && !got
        ? (<><p><span className="text-gold">Quest 3: Quick Hands.</span> Put a potion in a shortcut slot, so you can drink it in one tap mid-fight.</p><p className="text-steel">Open the Bag on the left, pick a potion, then tap an empty slot at the bottom of the screen.</p>{done}</>)
        : got
          ? (<><p><span className="text-gold">Quest 3: Quick Hands.</span> Put a potion in a shortcut slot.</p>{done}</>)
          : (<><p>Good. A potion at hand saves lives.</p><SpeechActions><PixelButton disabled={busy} onClick={() => advance(true)}>Done</PixelButton></SpeechActions></>))}
      {cur === 5 && (!got
        ? (<><p><span className="text-gold">Quest 4: Choose a Calling.</span> Visit the <span className="text-gold">Class Changer</span> and turn every Novice into a Recruit.</p><p className="text-steel">If you have already done it, I will check.</p><SpeechActions><PixelButton disabled={busy} onClick={() => advance()}>I have done it</PixelButton><PixelButton variant="ghost" onClick={close}>Not yet</PixelButton></SpeechActions></>)
        : (<><p><span className="text-gold">Quest 4: Choose a Calling.</span> Become a Recruit at the Class Changer.</p>{done}</>))}
      {cur === 6 && (<><p>That is everything I can teach you here. You are ready. Go back to the <span className="text-gold">Guild Manager</span>, he will take you on.</p>{done}</>)}
      {note && <p role="alert" className="text-lg text-ember">{note}</p>}
    </Speech>
  );
}

/** A Novice becomes the Recruit of its role at level 5 (free). Further classes come at level 20 from the Class Changer in the lobby. */
function ChangerBody({ step, onClassChanged, onClose }: { step: number; onClassChanged: () => void; onClose: () => void }) {
  const [mates, setMates] = useState<Mate[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ text: string; bad: boolean } | null>(null);
  const load = useCallback(async () => {
    const { data, error } = await createClient().from("fighters").select("id, level, nickname, team_slot, template:fighter_templates(name, role, archetype)").gt("team_slot", 0).order("team_slot");
    if (error) { setNote({ text: "Couldn't open the register. Try again.", bad: true }); return; }
    type Row = { id: string; level: number; nickname: string | null; template: { name: string; role: Role; archetype: string } | { name: string; role: Role; archetype: string }[] | null };
    setMates(((data ?? []) as unknown as Row[]).flatMap((r) => { const t = Array.isArray(r.template) ? r.template[0] : r.template; return t ? [{ id: r.id, name: r.nickname ?? t.name, level: r.level, archetype: t.archetype, role: t.role }] : []; }));
  }, []);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const become = async (m: Mate) => {
    if (busy) return;
    setBusy(true); setNote(null);
    const { error } = await createClient().rpc("choose_class", { p_fighter: m.id, p_archetype: RECRUITS[m.role].id });
    if (error) setNote({ text: error.message.includes("level_too_low") ? `Reach level ${RANK_LEVEL.common} first.` : "That didn't work. Try again.", bad: true });
    else { setNote({ text: `${m.name} is now a ${ARCHETYPE_LABEL[RECRUITS[m.role].id]}.`, bad: false }); onClassChanged(); }
    await load();
    setBusy(false);
  };

  return (
    <>
      <p>Every fighter starts as a Novice. At <span className="text-gold">level {RANK_LEVEL.common}</span> a Novice can become a Recruit of their role. Later classes build on that one.</p>
      {step < 5 && <p className="text-steel">The Trainer will tell you when it is time, but you are welcome to look around.</p>}
      {note && <p role="alert" className={`text-lg ${note.bad ? "text-ember" : "text-leaf"}`}>{note.text}</p>}
      <div className="space-y-1.5">
        {mates === null ? <div className="h-16 animate-pulse bg-panel" aria-busy="true" /> : mates.map((m) => (
          <div key={m.id} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-xl text-paper">{m.name}</p>
              <p className="truncate text-base text-steel">Lv {m.level} · {ARCHETYPE_LABEL[m.archetype] ?? m.archetype}</p>
            </div>
            {m.archetype === "novice"
              ? <PixelButton disabled={busy || m.level < RANK_LEVEL.common} onClick={() => become(m)} className="shrink-0 text-lg">{m.level < RANK_LEVEL.common ? `Level ${RANK_LEVEL.common}` : `Become ${ARCHETYPE_LABEL[RECRUITS[m.role].id].replace("Recruit ", "")}`}</PixelButton>
              : <span className="shrink-0 text-lg text-leaf">{isRecruit(m.archetype) ? "Recruit ✓" : "✓"}</span>}
          </div>
        ))}
      </div>
      <SpeechActions><PixelButton variant="ghost" onClick={onClose}>Done</PixelButton></SpeechActions>
    </>
  );
}
