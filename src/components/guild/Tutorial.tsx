"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { StarterPackExperience } from "@/components/pack/StarterPackExperience";
import { GAME_NAME } from "@/lib/brand";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import type { StarterFighter } from "@/lib/starter-pack";
import { createClient } from "@/lib/supabase/client";
import { InfoBox } from "./InfoBox";

const TOTAL = 6; // welcome, guild, quests, pack, fighters, ready

/** Steps 0-5. Progress is saved after each step so a refresh resumes where the player was. */
export function Tutorial({
  username, initialStep, packOpened, fighters: existing,
}: { username: string; initialStep: number; packOpened: boolean; fighters: GuildFighter[] }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(initialStep, TOTAL - 1));
  const [fighters, setFighters] = useState<(StarterFighter | GuildFighter)[]>(existing);
  const [pack, setPack] = useState(packOpened);
  const [busy, start] = useTransition();

  const save = (n: number) => void createClient().rpc("set_tutorial_step", { p_step: n });
  const go = (n: number) => {
    // A player who already has their fighters never needs to see the pack again.
    const next = n === 3 && pack ? (n > step ? 4 : 2) : n;
    setStep(next);
    save(next);
  };
  const finish = () =>
    start(async () => {
      await createClient().rpc("set_tutorial_step", { p_step: 6 });
      router.refresh();
    });

  if (step === 3 && !pack) {
    return (
      <StarterPackExperience
        username={username}
        onDone={(f) => {
          setFighters(f);
          setPack(true);
          setStep(4);
          save(4);
        }}
      />
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
      case 4:
        return (
          <InfoBox step={4} total={TOTAL} title="Meet your fighters" onBack={() => go(pack && existing.length ? 2 : 4)} onNext={() => go(5)}>
            <p>Each fighter has a role, stats and skills. Every one starts as a <span className="text-gold">Novice</span>.</p>
            <p>At level 10 a fighter picks a class. Classes start at Rank 1 and climb to Rank 4 as they level.</p>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {fighters.slice(0, 3).map((f) => (
                <div key={f.id} className="flex min-w-0 flex-col items-center text-center text-base">
                  <FighterSprite spriteKey={f.template.sprite_key} role={f.template.role} />
                  <span className="truncate text-gold">{f.template.name}</span>
                  <span className="text-steel">{f.template.role} · Lv {f.level}</span>
                </div>
              ))}
            </div>
          </InfoBox>
        );
      default:
        return (
          <InfoBox step={5} total={TOTAL} title="Your guild awaits" onBack={() => go(4)} onNext={finish} nextLabel="Enter the guild" busy={busy}>
            <p>Your first job is waiting on the job board. Take it, win a battle and earn your first reward.</p>
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
