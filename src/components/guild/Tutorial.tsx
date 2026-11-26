"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { GAME_NAME } from "@/lib/brand";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import type { StarterFighter } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";
import { Music } from "@/components/Music";
import { GuildManager } from "./GuildManager";
import { InfoBox } from "./InfoBox";

/** The tutorial's speech box with the guild manager standing inside it. */
function ManagerBox(props: React.ComponentProps<typeof InfoBox>) {
  return <InfoBox portrait={<GuildManager height={150} />} {...props} />;
}
import { TutorialFight } from "./TutorialFight";

const TOTAL = 6; // welcome, guild, what you'll do, starters, fight 1, fight 2

const ROLE_LABEL = { tank: "Tank", healer: "Healer", dps: "Damage" } as const;

/** Steps 0-5. Progress is saved after each step so a refresh resumes where the player was. */
/** Same rule as the database: 3 to 20 letters, numbers, spaces, - _ or ', starting and ending with a letter or number. */
const NAME_OK = (n: string) => /^[A-Za-z0-9][A-Za-z0-9_ '-]{1,18}[A-Za-z0-9]$/.test(n) && !/^player_/i.test(n) && !/ {2}/.test(n);

export function Tutorial({ username, initialStep, fighters: existing }: { username: string; initialStep: number; fighters: GuildFighter[] }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, TOTAL - 1));
  const [fighters, setFighters] = useState<(StarterFighter | GuildFighter)[]>(existing);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // Guests start with a placeholder name; the guild manager asks for a real one (checked against everyone else's).
  const [named, setNamed] = useState(!/^player_/i.test(username));
  const [name, setName] = useState(/^player_/i.test(username) ? "" : username);
  const [remote, setRemote] = useState<{ name: string; res: "ok" | "taken" | "error" } | null>(null);
  const [claimErr, setClaimErr] = useState<"taken" | "bad" | "error" | null>(null);
  const [claiming, setClaiming] = useState(false);
  const typed = name.trim();
  const check: "idle" | "checking" | "ok" | "taken" | "bad" | "error" =
    claimErr ?? (!typed ? "idle" : !NAME_OK(typed) ? "bad" : remote?.name === typed ? remote.res : "checking");
  useEffect(() => {
    if (named || !typed || !NAME_OK(typed)) return;
    let live = true;
    const t = setTimeout(async () => {
      const { data, error: e } = await createClient().rpc("username_available", { p_name: typed });
      if (live) setRemote({ name: typed, res: e ? "error" : data ? "ok" : "taken" });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [typed, named]);
  const claim = async () => {
    if (claiming || check !== "ok") return;
    setClaiming(true);
    const { data, error: e } = await createClient().rpc("claim_username", { p_name: typed });
    setClaiming(false);
    if (e) { setClaimErr(e.message.includes("name_taken") ? "taken" : e.message.includes("bad_name") ? "bad" : "error"); return; }
    setName(String(data));
    setNamed(true);
    go(1);
  };

  // rpc() only sends once awaited, so the save lives in an async function.
  const save = async (n: number) => { await createClient().rpc("set_tutorial_step", { p_step: n }); };
  const go = (n: number) => {
    setStep(n);
    void save(n);
  };
  const finish = () =>
    start(async () => {
      await createClient().rpc("set_tutorial_step", { p_step: 6 });
      router.refresh();
    });

  // Everyone starts with three Novices; the server hands them out the first time they're needed.
  useEffect(() => {
    if (step < 3 || fighters.length > 0) return;
    let live = true;
    createClient().rpc("grant_novices").then(({ data, error: e }) => {
      if (!live) return;
      if (e || !Array.isArray(data)) setError("Couldn't set up your fighters. Refresh and try again.");
      else setFighters(data as StarterFighter[]);
    });
    return () => { live = false; };
  }, [step, fighters.length]);

  if (step === 4 || step === 5) {
    return (
      <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-4 p-3 sm:p-6">
        <TutorialFight key={step} stage={step === 4 ? 1 : 2} step={step} total={TOTAL} onBack={() => go(step - 1)} onWin={() => (step === 4 ? go(5) : finish())} />
      </main>
    );
  }

  const box = (() => {
    switch (step) {
      case 0:
        return (
          named ? (
            <ManagerBox step={0} total={TOTAL} title={`Welcome to ${GAME_NAME}`} onNext={() => go(1)} nextLabel="Let's go">
              <p>Hello, {name}! Your adventure starts here.</p>
            </ManagerBox>
          ) : (
            <ManagerBox step={0} total={TOTAL} title={`Welcome to ${GAME_NAME}`} onNext={claim} nextLabel="That's me" busy={check !== "ok" || claiming}>
              <p>Welcome, adventurer! Before we begin, what should I call you?</p>
              <input
                value={name} onChange={(e) => { setName(e.target.value); setClaimErr(null); }} onKeyDown={(e) => { if (e.key === "Enter") void claim(); }}
                maxLength={20} autoFocus autoComplete="off" autoCapitalize="words" spellCheck={false} aria-label="Your name" placeholder="Your name"
                className="w-full border-4 border-paper bg-ink px-3 py-2 text-xl text-paper outline-none focus:border-gold"
              />
              <p role="status" className={`min-h-6 text-lg ${check === "ok" ? "text-leaf" : check === "idle" || check === "checking" ? "text-steel" : "text-ember"}`}>
                {check === "ok" ? "That name is yours to take." : check === "checking" ? "Checking…" : check === "taken" ? "Someone already uses that name. Try another."
                  : check === "bad" ? "3 to 20 letters, numbers, spaces, - or _." : check === "error" ? "Couldn't check just now. Try again." : "This is how other players will see you."}
              </p>
            </ManagerBox>
          )
        );
      case 1:
        return (
          <ManagerBox step={1} total={TOTAL} title="You run a guild of adventurers" onBack={() => go(0)} onNext={() => go(2)}>
            <p>You manage an adventure guild. You hire or buy fighters to work for you and go on quests. Your guild grows as they do.</p>
          </ManagerBox>
        );
      case 2:
        return (
          <ManagerBox step={2} total={TOTAL} title="What you'll do" onBack={() => go(1)} onNext={() => go(3)}>
            <p>Recruit up to {ROSTER_CAP} fighters in your roster.</p>
            <p>Take requests on the job board from real players, or go on quests across the different floors.</p>
            <p>Enter your fighters into arena tournaments to climb the leaderboard, win <span className="text-gold">real money</span> and <span className="text-gold">prices</span>.</p>
          </ManagerBox>
        );
      default:
        return (
          <ManagerBox step={3} total={TOTAL} title="Meet your Starters" onBack={() => go(2)} onNext={() => go(4)} nextLabel="Next" busy={fighters.length === 0}>
            <p>Each Starter has a role, stats and skills. Every one starts as a <span className="text-gold">Novice</span>.</p>
            <p>At level 5, you can rank up a Novice into a Recruit, and many other <span className="text-gold">Classes</span> as you level up.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {fighters.slice(0, 3).map((f) => (
                <div key={f.id} className="flex min-w-0 flex-col items-center text-center text-base">
                  <FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} />
                  <span className="truncate text-gold">{f.template.name}</span>
                  <span className="text-steel">{ROLE_LABEL[f.template.role]} · Lv {f.level}</span>
                </div>
              ))}
              {fighters.length === 0 && !error && [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse bg-panel" aria-busy="true" />)}
            </div>
            {error && <p role="alert" className="text-xl text-ember">{error}</p>}
          </ManagerBox>
        );
    }
  })();

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 p-6 short:gap-2 short:p-2">
      <Music track="intro" />
      <div key={step} className="flex w-full flex-col items-center justify-center gap-3">
        {box}
      </div>
    </main>
  );
}
