"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FighterCard } from "@/components/pack/FighterCard";
import { GAME_NAME } from "@/lib/brand";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import type { StarterFighter } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";
import { InfoBox } from "./InfoBox";
import { TutorialFight } from "./TutorialFight";

const TOTAL = 6; // welcome, guild, what you'll do, recruits, fight 1, fight 2

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
            <p>Hello, {username}! A new adventure starts here.</p>
          </InfoBox>
        );
      case 1:
        return (
          <InfoBox step={1} total={TOTAL} title="You run a guild" onBack={() => go(0)} onNext={() => go(2)}>
            <p>You are the guild manager. Your fighters work for you, and the guild grows as they do.</p>
          </InfoBox>
        );
      case 2:
        return (
          <InfoBox step={2} total={TOTAL} title="What you'll do" onBack={() => go(1)} onNext={() => go(3)}>
            <p>Recruit fighters, up to {ROSTER_CAP} in your roster.</p>
            <p>Send them on quests from the job board, or up the adventure floors.</p>
            <p>Enter them in arena tournaments to climb the leaderboard.</p>
          </InfoBox>
        );
      default:
        return (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
              {fighters.slice(0, 3).map((f, i) => (
                <FighterCard key={f.id} fighter={f} delayMs={i * 350} />
              ))}
              {fighters.length === 0 && !error && [0, 1, 2].map((i) => <div key={i} className="h-72 animate-pulse bg-panel" aria-busy="true" />)}
            </div>
            {error && <p role="alert" className="text-xl text-ember">{error}</p>}
            <InfoBox step={3} total={TOTAL} title="Meet your recruits" onBack={() => go(2)} onNext={() => go(4)} nextLabel="First fight" busy={fighters.length === 0}>
              <p>Three Novices have joined your guild. Each has a role, stats and skills.</p>
              <p>At level 10 a Novice can choose a class and start climbing the ranks.</p>
            </InfoBox>
          </div>
        );
    }
  })();

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center gap-6 p-6">
      <div key={step} className="flex w-full justify-center">{box}</div>
    </main>
  );
}
