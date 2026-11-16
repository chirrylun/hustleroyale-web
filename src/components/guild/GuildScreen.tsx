"use client";

import { BagButton } from "@/components/floor/BagButton";
import { Music } from "@/components/Music";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";
import { MAX_FLOOR, themeOf } from "@/lib/world/floor";
import { Npc } from "@/components/npc/Npc";
import { GuildHall } from "./GuildHall";
import { clearExpedition } from "@/lib/world/expedition";
import { itemImage, itemName } from "@/lib/items";
import hallLayout from "./layout.json";
import { InfoBox } from "./InfoBox";
import { JobBoard } from "./JobBoard";
import { PartyPanel } from "./PartyPanel";

/** Groups that stay open while the first job is unfinished: the job board itself and the adventure, where the job is done. */
const OPEN_DURING_FIRST_JOB = ["jobs", "adventure"];
const FIRST_JOB_NOTICE = "Complete your first quest on the job board first.";

/** Tutorial job: kill a bat on Floor 1 (steps 6-8 of the tutorial); afterwards the board is "empty" until more jobs land. */
export function GuildScreen({ username, coins, level, fighters, tutorialStep, floorCleared = 0, floorUnlocked = 1, enterFloor = 0, enterLobby = false }: { username: string; coins: number; level: number; fighters: GuildFighter[]; tutorialStep: number; floorCleared?: number; floorUnlocked?: number; enterFloor?: number; enterLobby?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(tutorialStep);
  const [panel, setPanel] = useState<"jobs" | "adventure" | "party" | "lobby" | null>(enterFloor >= 1 && enterFloor <= floorUnlocked && tutorialStep >= 6 ? "party" : enterLobby && tutorialStep >= 9 ? "lobby" : null);
  const [floorSel, setFloorSel] = useState(enterFloor >= 1 ? enterFloor : 1);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, start] = useTransition();

  // Coming back to the guild always starts at the hall, not on whatever panel was open when you left.
  useEffect(() => {
    setPanel(enterFloor >= 1 && enterFloor <= floorUnlocked && tutorialStep >= 6 ? "party" : enterLobby && tutorialStep >= 9 ? "lobby" : null);
    setNotice(null);
    clearExpedition(); // resting at the guild heals everyone
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t);
  }, [notice]);

  const firstJobOpen = step < 9;
  /** Floors open one at a time: every cleared floor plus the next one. Nothing beyond that is shown. */
  const unlocked = Math.min(MAX_FLOOR, floorUnlocked);

  // Supabase's rpc() only sends once it is awaited, so every call here is awaited inside an async function.
  const saveStep = async (n: number) => {
    const { error } = await createClient().rpc("set_tutorial_step", { p_step: n });
    return !error;
  };
  const setTut = (n: number) => { setStep(n); void saveStep(n); };
  /** Taking the job is saved first: the server only counts the bat kill (and the claim) once it knows the job was taken. */
  const takeJob = () =>
    start(async () => {
      setMsg(null);
      if (!(await saveStep(8))) return setMsg("Couldn't take the job. Try again.");
      setStep(8);
      setPanel(null); // the adventure gate glows next
    });
  const claim = () =>
    start(async () => {
      setMsg(null);
      const { error } = await createClient().rpc("claim_first_job");
      if (error) {
        if (error.message.includes("job_not_done")) return setMsg("Kill the bat on Floor 1 first.");
        if (error.message.includes("no_job_to_claim")) return setMsg("Take the job from the board first.");
        return setMsg("That didn't work. Try again.");
      }
      setStep(9);
      try { localStorage.removeItem("pocketrpg-first-job-done"); } catch { /* ignore */ }
      router.refresh();
    });

  // Once the first job is taken, the adventure gate glows. Once it is done on the field (the player is told there), the job board glows to hand it in.
  const [intro, setIntro] = useState(0);
  const [jobDone, setJobDone] = useState(false);
  useEffect(() => { try { setJobDone(localStorage.getItem("pocketrpg-first-job-done") === "1"); } catch { /* private mode: fine */ } }, []);

  const onAction = (a: string) => {
    if (a === "jobs") {
      if (step === 6) setTut(7);
      setPanel("jobs");
    } else if (a === "lobby") setPanel("lobby");
    else setPanel("adventure");
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-3 p-3 sm:p-6 short:gap-1 short:p-1.5">
      <Music track="guild" />
      <header className="flex flex-wrap items-center justify-between gap-2 text-xl short:text-base">
        <h1 className="text-2xl uppercase text-gold short:text-lg">{username}&apos;s Guild</h1>
        <p className="flex gap-4 text-paper">
          <span>🪙 {coins}</span>
          <span>Lv {level}</span>
          <Link href="/team" className="text-steel underline">Roster {fighters.length}/{ROSTER_CAP}</Link>
        </p>
      </header>

      <div className="pixel-box relative overflow-hidden bg-night short:mx-auto short:w-full short:max-w-[var(--hall-w)]" style={{ ["--hall-w" as string]: `calc((100dvh - 2.75rem) * ${hallLayout.cols / hallLayout.rows})` }}>
        <BagButton />
        <GuildHall
          fighters={fighters}
          onAction={onAction}
          highlight={step === 6 ? "jobs" : step === 8 && !panel ? (jobDone ? "jobs" : "adventure") : undefined}
          isLocked={(group) => firstJobOpen && !OPEN_DURING_FIRST_JOB.includes(group)}
          onBlocked={() => { setPanel(null); setNotice(FIRST_JOB_NOTICE); }}
        />

        {step === 6 && !panel && (
          <div className="fixed inset-x-0 bottom-3 z-[200] short:bottom-1.5 flex items-end justify-center gap-2 px-3 sm:gap-4">
            {intro === 0 ? (
              <InfoBox portrait={<Npc name="secretary" className="w-16 sm:w-20 short:w-12" />} step={0} total={2} title="Hello there!" onNext={() => setIntro(1)} nextLabel="Next">
                <p>Hi, I&apos;m your quest manager. I hand out every job in the guild.</p>
                <p>This is your guild. You manage your adventurers and send them out on quests from here.</p>
              </InfoBox>
            ) : (
              <InfoBox portrait={<Npc name="secretary" className="w-16 sm:w-20 short:w-12" />} step={1} total={2} title="The job board" onBack={() => setIntro(0)} onNext={() => onAction("jobs")} nextLabel="Open job board">
                <p>This is the job board. Jobs are posted here by other real players, people that need your help or from The Adventurer's Council.</p>
                <p>Tap the glowing job board when you want to take a job. Let's start with your first one.</p>
              </InfoBox>
            )}
          </div>
        )}

        {step === 8 && !panel && !notice && (
          <div className="fixed inset-x-0 bottom-3 z-[200] short:bottom-1.5 flex justify-center px-3">
            {jobDone ? (
              <InfoBox portrait={<Npc name="secretary" className="w-16 sm:w-20 short:w-12" />} step={0} total={1} title="Success!" onNext={() => onAction("jobs")} nextLabel="Open job board">
                <p>You beat the bat, hand in your job on the job board to get your reward.</p>
                <p>Tap the glowing Job board.</p>
              </InfoBox>
            ) : (
              <InfoBox portrait={<Npc name="secretary" className="w-16 sm:w-20 short:w-12" />} step={0} total={1} title="Time to head out" onNext={() => onAction("adventure")} nextLabel="Open the gate">
                <p>You took the job successfully. Jobs are done out on the floors, so tap the glowing map to go on quests.</p>
                <p>Pick floor 1, choose your fighters and go find that bat.</p>
              </InfoBox>
            )}
          </div>
        )}

        {notice && !panel && (
          <div className="fixed inset-x-0 bottom-3 z-[200] short:bottom-1.5 flex justify-center px-3">
            <div role="alert" className="pixel-box card-reveal flex w-full max-w-xl items-center justify-between gap-3 bg-night p-4 text-xl text-paper">
              <p>{notice}</p>
              <PixelButton variant="ghost" className="shrink-0 text-base" onClick={() => setNotice(null)}>OK</PixelButton>
            </div>
          </div>
        )}

        {panel && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center bg-ink/70 p-3 short:p-2">
            <div className="pixel-box card-reveal max-h-[94dvh] w-full max-w-lg overflow-y-auto bg-night p-5 short:max-w-2xl short:p-3">
              {panel === "lobby" ? (
                <PartyPanel fighters={fighters} kicker="Meet other players" title="Main Lobby" goLabel="Enter the lobby" startWithOne onBack={() => setPanel(null)} onGo={() => router.push("/lobby")} />
              ) : panel === "party" ? (
                <PartyPanel floorNo={floorSel} fighters={fighters} onBack={() => setPanel("adventure")} onGo={() => router.push(`/floor/${floorSel}`)} />
              ) : panel === "adventure" ? (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Adventure</h2>
                  {step < 9 && <p className="mb-2 text-xl text-paper">Floor 1 has a bat waiting for you.</p>}
                  <div className="max-h-[55dvh] short:max-h-[60dvh] space-y-3 overflow-y-auto pr-1">
                    {[0, 1, 2, 3].filter((t) => t * 10 + 1 <= unlocked).map((t) => (
                      <div key={t}>
                        <p className="mb-1 text-base uppercase text-steel">{themeOf(t * 10 + 1).name}</p>
                        <div className="grid grid-cols-5 gap-1.5">
                          {Array.from({ length: 10 }, (_, i) => t * 10 + i + 1).filter((n) => n <= unlocked).map((n) => (
                            <button key={n} type="button" onClick={() => { setFloorSel(n); setPanel("party"); }} className={`pixel-box py-1.5 text-center text-xl ${n <= floorCleared ? "bg-panel text-leaf" : "bg-gold text-ink"}`}>{n}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : step >= 10 ? (
                <JobBoard onChanged={() => router.refresh()} />
              ) : step === 9 ? (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Job board</h2>
                  <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xl text-gold">
                    <span>Reward: 100 coins · 60 XP each</span>
                    {[["hp_potion", 3], ["mp_potion", 2]].map(([s, n]) => (
                      <span key={s} className="inline-flex items-center gap-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={itemImage(s as string)} alt="" className="h-8 w-8 [image-rendering:pixelated]" draggable={false} />{n} {itemName(s as string)}s
                      </span>
                    ))}
                  </p>
                  <p className="text-xl text-paper">You completed your first job! More jobs are posted here by other players, NPCs that need your help or special requests with extra rewards. You can also post jobs on the board for other players to complete with how much you're willing to pay for completing it successfully.</p>
                  <div className="mt-4"><PixelButton onClick={() => setTut(10)}>Open the job board</PixelButton></div>
                </>
              ) : step < 7 ? (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Job board</h2>
                  <p className="text-xl text-paper">No jobs yet.</p>
                </>
              ) : (
                <>
                  <h2 className="mb-2 text-2xl uppercase text-gold">Job board</h2>
                  {step === 7 && (
                    <div className="pixel-box mb-3 flex items-end gap-3 bg-panel p-3">
                      <Npc name="secretary" className="w-14 shrink-0" />
                      <p className="text-lg text-paper">Here&apos;s a job for you. Take it, then head out to get it done.</p>
                    </div>
                  )}
                  <div className="pixel-box bg-panel p-3 text-xl text-paper">
                    <p className="uppercase text-leaf">First job · Guild</p>
                    <p>Kill a bat on Floor 1.</p>
                    <p className="text-steel">Reward: <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle">100 coins, 60 XP for each fighter on your team
                      {["hp_potion:3", "mp_potion:2"].map((x) => { const [s, n] = x.split(":"); return (
                        <span key={s} className="inline-flex items-center gap-1 text-gold">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={itemImage(s)} alt="" className="h-7 w-7 [image-rendering:pixelated]" draggable={false} />{n} {itemName(s)}s
                        </span>); })}</span></p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {step === 7 ? (
                      <PixelButton disabled={busy} onClick={takeJob}>Take job</PixelButton>
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
              {panel !== "party" && <div className="mt-4 text-right">
                <PixelButton variant="ghost" className="text-base" onClick={() => setPanel(null)}>Close</PixelButton>
              </div>}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
