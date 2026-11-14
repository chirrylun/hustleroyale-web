"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { GAME_NAME } from "@/lib/brand";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import type { StarterFighter } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";
import { InfoBox } from "./InfoBox";
import { TutorialFight } from "./TutorialFight";

const TOTAL = 6; // welcome, guild, what you'll do, starters, fight 1, fight 2

const ROLE_LABEL = { tank: "Tank", healer: "Healer", dps: "Damage" } as const;

/** Steps 0-5. Progress is saved after each step so a refresh resumes where the player was. */
export function Tutorial({ username, initialStep, fighters: existing }: { username: string; initialStep: number; fighters: GuildFighter[] }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, TOTAL - 1));
  const [fighters, setFighters] = useState<(StarterFighter | GuildFighter)[]>(existing);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const go = (n: number) => {
    setStep(n);
    void createClient().rpc("set_tutorial_step", { p_step: n });
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
          <InfoBox step={0} total={TOTAL} title={`Welcome to ${GAME_NAME}`} onNext={() => go(1)} nextLabel="Let's go">
            <p>Hello, {username}! Your adventure starts here.</p>
          </InfoBox>
        );
      case 1:
        return (
          <InfoBox step={1} total={TOTAL} title="You run a guild of adventurers" onBack={() => go(0)} onNext={() => go(2)}>
            <p>You manage an adventure guild. You hire or buy fighters to work for you and go on quests. Your guild grows as they do.</p>
          </InfoBox>
        );
      case 2:
        return (
          <InfoBox step={2} total={TOTAL} title="What you'll do" onBack={() => go(1)} onNext={() => go(3)}>
            <p>Recruit up to {ROSTER_CAP} fighters in your roster.</p>
            <p>Take requests on the job board from real players, or go on quests across the different floors.</p>
            <p>Enter your fighters into arena tournaments to climb the leaderboard, win <span className="text-gold">real money</span> and <span className="text-gold">prices</span>.</p>
          </InfoBox>
        );
      default:
        return (
          <InfoBox step={3} total={TOTAL} title="Meet your Starters" onBack={() => go(2)} onNext={() => go(4)} nextLabel="Next" busy={fighters.length === 0}>
            <p>Each Starter has a role, stats and skills. Every one starts as a <span className="text-gold">Novice</span>.</p>
            <p>At level 10, you can rank up a Novice into a Recruit, and many other <span className="text-gold">Classes</span> as you level up.</p>
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
          </InfoBox>
        );
    }
  })();

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <div key={step} className="flex w-full justify-center">{box}</div>
    </main>
  );
}
