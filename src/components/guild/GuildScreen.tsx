"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";
import { MAX_FLOOR, themeOf } from "@/lib/world/floor";
import { GuildHall } from "./GuildHall";
import { InfoBox } from "./InfoBox";

/** Groups that stay open while the first job is unfinished: the job board itself and the adventure, where the job is done. */
const OPEN_DURING_FIRST_JOB = ["jobs", "adventure"];
const FIRST_JOB_NOTICE = "Complete your first quest on the job board first.";

/** Tutorial job: kill a bat on Floor 1 (steps 6-8 of the tutorial); afterwards the board is "empty" until more jobs land. */
export function GuildScreen({ username, coins, level, fighters, tutorialStep, floorCleared = 0 }: { username: string; coins: number; level: number; fighters: GuildFighter[]; tutorialStep: number; floorCleared?: number }) {
  const router = useRouter();
  const [step, setStep] = useState(tutorialStep);
  const [panel, setPanel] = useState<"jobs" | "adventure" | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, start] = useTransition();

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const firstJobOpen = step < 9;

  const setTut = (n: number) => { setStep(n); void createClient().rpc("set_tutorial_step", { p_step: n }); };
  const claim = () =>
    start(async () => {
      setMsg(null);
      const { error } = await createClient().rpc("claim_first_job");
      if (error) return setMsg(error.message.includes("job_not_done") ? "Kill the bat on Floor 1 first." : "That didn't work. Try again.");
      setStep(9);
      router.refresh();
    });

  const onAction = (a: string) => {
    if (a === "jobs") {
      if (step === 6) setTut(7);
      setPanel("jobs");
    } else setPanel("adventure");
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
        <GuildHall
          fighters={fighters}
          onAction={onAction}
          highlight={step === 6 ? "jobs" : undefined}
          isLocked={(group) => firstJobOpen && !OPEN_DURING_FIRST_JOB.includes(group)}
          onBlocked={() => { setPanel(null); setNotice(FIRST_JOB_NOTICE); }}
        />

        {step === 6 && !panel && (
          <div className="absolute inset-x-0 bottom-3 z-[200] flex justify-center px-3">
            <InfoBox step={0} total={1} title="Your guild" onNext={() => onAction("jobs")} nextLabel="Open job board">
              <p>This is home. Your fighters roam here. Tap one, then tap the floor to send it somewhere.</p>
              <p>Tap the glowing job board to find work.</p>
            </InfoBox>
          </div>
        )}

        {notice && !panel && (
          <div className="absolute inset-x-0 bottom-3 z-[200] flex justify-center px-3">
            <div role="alert" className="pixel-box card-reveal flex w-full max-w-xl items-center justify-between gap-3 bg-night p-4 text-xl text-paper">
              <p>{notice}</p>
              <PixelButton variant="ghost" className="shrink-0 text-base" onClick={() => setNotice(null)}>OK</PixelButton>
            </div>
          </div>
        )}

        {panel && (
          <div className="absolute inset-0 z-[300] flex items-center justify-center bg-ink/70 p-3">
            <div className="pixel-box card-reveal w-full max-w-lg bg-night p-5">
              {panel === "adventure" ? (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Adventure</h2>
                  {step < 9 && <p className="mb-2 text-xl text-paper">Floor 1 has a bat waiting for you.</p>}
                  <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                    {[0, 1, 2, 3].map((t) => (
                      <div key={t}>
                        <p className="mb-1 text-base uppercase text-steel">{themeOf(t * 10 + 1).name}</p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {Array.from({ length: 10 }, (_, i) => t * 10 + i + 1).filter((n) => n <= MAX_FLOOR).map((n) =>
                            n <= floorCleared + 1 ? (
                              <Link key={n} href={`/floor/${n}`} className={`pixel-box py-1.5 text-center text-xl ${n <= floorCleared ? "bg-panel text-leaf" : "bg-gold text-ink"}`}>{n}</Link>
                            ) : (
                              <span key={n} className="pixel-box bg-night py-1.5 text-center text-xl text-steel/50" aria-label={`Floor ${n} locked`}>{n}</span>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
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
                    <p>Kill a bat on Floor 1.</p>
                    <p className="text-steel">Reward: 100 coins and 60 XP for each fighter on your team.</p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {step === 7 ? (
                      <PixelButton onClick={() => setTut(8)}>Take job</PixelButton>
                    ) : (
                      <>
                        <PixelButton onClick={() => setPanel("adventure")}>Go to adventure</PixelButton>
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
