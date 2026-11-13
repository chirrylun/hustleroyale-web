"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";
import { GuildHall } from "./GuildHall";
import { InfoBox } from "./InfoBox";

/** Tutorial job: win a practice battle (steps 6-8 of the tutorial); afterwards the board is "empty" until Step 3 lands. */
export function GuildScreen({ username, coins, level, fighters, tutorialStep }: { username: string; coins: number; level: number; fighters: GuildFighter[]; tutorialStep: number }) {
  const router = useRouter();
  const [step, setStep] = useState(tutorialStep);
  const [panel, setPanel] = useState<"jobs" | "soon" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const setTut = (n: number) => { setStep(n); void createClient().rpc("set_tutorial_step", { p_step: n }); };
  const claim = () =>
    start(async () => {
      setMsg(null);
      const { error } = await createClient().rpc("claim_first_job");
      if (error) return setMsg(error.message.includes("job_not_done") ? "Win a battle in the arena first." : "That didn't work. Try again.");
      setStep(9);
      router.refresh();
    });

  const onAction = (a: string) => {
    if (a === "jobs") {
      if (step === 6) setTut(7);
      setPanel("jobs");
    } else setPanel("soon");
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-2 text-xl">
        <h1 className="text-2xl uppercase text-gold">{username}&apos;s Guild</h1>
        <p className="flex gap-4 text-paper">
          <span>🪙 {coins}</span>
          <span>Lv {level}</span>
          <Link href="/team" className="text-steel underline">Roster {fighters.length}/{ROSTER_CAP}</Link>
        </p>
      </header>

      <div className="pixel-box relative overflow-hidden bg-night">
        <GuildHall fighters={fighters} onAction={onAction} highlight={step === 6 ? "jobs" : undefined} />

        {step === 6 && !panel && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
            <InfoBox step={0} total={1} title="Your guild" onNext={() => onAction("jobs")} nextLabel="Open job board">
              <p>This is home. Your fighters roam here. Tap one, then tap the floor to send it somewhere.</p>
              <p>Tap the glowing job board to find work.</p>
            </InfoBox>
          </div>
        )}

        {panel && (
          <div className="absolute inset-0 z-[100] flex items-center justify-center bg-ink/70 p-3">
            <div className="pixel-box card-reveal w-full max-w-lg bg-night p-5">
              {panel === "soon" ? (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Coming soon</h2>
                  <p className="text-xl text-paper">The adventure floors open soon.</p>
                </>
              ) : step >= 9 || step < 7 ? (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Job board</h2>
                  <p className="text-xl text-paper">{step >= 9 ? "First job done! More jobs are posted here soon." : "No jobs yet."}</p>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Job board</h2>
                  <div className="pixel-box bg-panel p-3 text-xl text-paper">
                    <p className="uppercase text-leaf">First job · Guild</p>
                    <p>Win a practice battle in the arena.</p>
                    <p className="text-steel">Reward: 100 coins and 60 XP for each fighter on your team.</p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {step === 7 ? (
                      <PixelButton onClick={() => setTut(8)}>Take job</PixelButton>
                    ) : (
                      <>
                        <Link href="/arena" className="pixel-btn bg-leaf px-4 py-2 text-lg uppercase text-ink">Go to arena</Link>
                        <PixelButton variant="ghost" disabled={busy} onClick={claim}>Claim reward</PixelButton>
                      </>
                    )}
                  </div>
                  {msg && <p role="alert" className="mt-2 text-base text-ember">{msg}</p>}
                </>
              )}
              <div className="mt-4 text-right">
                <PixelButton variant="ghost" className="text-base" onClick={() => setPanel(null)}>Close</PixelButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
