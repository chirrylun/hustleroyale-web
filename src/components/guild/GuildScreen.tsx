"use client";

import { BagButton } from "@/components/floor/BagButton";
import { Music } from "@/components/Music";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { ROSTER_CAP, type GuildFighter } from "@/lib/guild";
import { createClient } from "@/lib/supabase/client";
import { MAX_FLOOR, themeOf } from "@/lib/world/floor";
import { Npc } from "@/components/npc/Npc";
import { GuildHall } from "./GuildHall";
import { clearExpedition, readLastHealth } from "@/lib/world/expedition";
import { gameApi } from "@/lib/api";
import { itemImage, itemName } from "@/lib/items";
import type { PlacedDecor } from "@/lib/guild-ranks";
import { InfoBox } from "./InfoBox";
import { JobBoard } from "./JobBoard";
import { PartyPanel } from "./PartyPanel";

/** Groups that stay open while the first job is unfinished: the job board itself and the adventure, where the job is done. */
const OPEN_DURING_FIRST_JOB = ["jobs", "adventure"];
const FIRST_JOB_NOTICE = "Complete your first quest on the job board first.";

/** Tutorial job: kill a bat on Floor 1 (steps 6-8 of the tutorial); afterwards the board is "empty" until more jobs land. */
export function GuildScreen({ username, coins, level, fighters: dbFighters, tutorialStep, floorCleared = 0, floorUnlocked = 1, enterFloor = 0, guildRank = 1, decor: initialDecor = [] }: { guildRank?: number; decor?: PlacedDecor[]; username: string; coins: number; level: number; fighters: GuildFighter[]; tutorialStep: number; floorCleared?: number; floorUnlocked?: number; enterFloor?: number; enterLobby?: boolean }) {
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const rank = guildRank;
  const [decor, setDecor] = useState<PlacedDecor[]>(initialDecor);
  const [editing, setEditing] = useState(false);
  const [carry, setCarry] = useState<string | null>(null);
  const stored = useMemo(() => decor.filter((d) => d.x == null), [decor]);
  // Start centred on the hall's top, where the doors and boards are.
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = (el.scrollWidth - el.clientWidth) / 2; }, []);
  const setPos = (id: string, x: number | null, y: number | null) => setDecor((all) => all.map((d) => (d.id === id ? { ...d, x, y } : d)));
  const placeCarried = (x: number, y: number) => {
    if (!carry) return;
    const id = carry, px = Math.min(0.96, Math.max(0.04, x)), py = Math.min(0.97, Math.max(0.4, y));
    setPos(id, px, py);
    setCarry(null);
    void createClient().rpc("guild_place", { p_id: id, p_x: px, p_y: py }).then(({ error }) => { if (error) { setPos(id, null, null); setNotice("That didn't fit there."); } });
  };
  const pickUp = (id: string) => {
    setPos(id, null, null);
    setCarry(id);
    void createClient().rpc("guild_unplace", { p_id: id });
  };
  const [step, setStep] = useState(tutorialStep);
  const [panel, setPanel] = useState<"jobs" | "adventure" | "party" | null>(enterFloor >= 1 && enterFloor <= floorUnlocked && tutorialStep >= 6 ? "party" : null);
  const [floorSel, setFloorSel] = useState(enterFloor >= 1 ? enterFloor : 1);
  const [msg, setMsg] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, start] = useTransition();
  // What the party's health was when they left the floor (kept by this browser). If the database copy is older or missing, use this one.
  const [carried, setCarried] = useState<{ at: number; fracs: Record<string, number> } | null>(null);
  const fighters = useMemo(() => !carried ? dbFighters : dbFighters.map((f) => {
    const fr = carried.fracs[f.id];
    if (fr === undefined) return f;
    const dbAt = f.hp_at ? new Date(f.hp_at).getTime() : 0;
    return carried.at > dbAt ? { ...f, hp_frac: fr, hp_at: new Date(carried.at).toISOString() } : f;
  }), [dbFighters, carried]);

  // Coming back to the guild always starts at the hall, not on whatever panel was open when you left.
  useEffect(() => {
    setPanel(enterFloor >= 1 && enterFloor <= floorUnlocked && tutorialStep >= 6 ? "party" : null);
    setNotice(null);
    const last = readLastHealth();
    if (last) {
      setCarried(last);
      // Make sure the server has it too (the floor's own save may not have landed).
      const ids = Object.keys(last.fracs).slice(0, 3);
      if (ids.length) gameApi("/floor/hp", { ids, fracs: ids.map((i) => Math.min(1, Math.max(0, last.fracs[i]))) }).catch(() => { /* fine, this tab still shows it */ });
    }
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
    } else if (a === "lobby") router.push("/lobby"); // your first equipped fighter goes in on their own
    else setPanel("adventure");
  };

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-night">
      <Music track="guild" />
      <header className="pointer-events-none absolute inset-x-0 top-0 z-[250] flex flex-wrap items-start justify-between gap-2 p-2 text-xl short:text-base">
        <h1 className="pointer-events-auto bg-ink/80 px-2 py-0.5 text-xl uppercase text-gold short:text-base">{username}&apos;s Guild</h1>
        <p className="pointer-events-auto flex gap-3 bg-ink/80 px-2 py-0.5 text-paper">
          <span>🪙 {coins}</span>
          <span>Lv {level}</span>
          <Link href="/team" className="text-steel underline">Roster {fighters.length}/{ROSTER_CAP}</Link>
        </p>
      </header>

      <div className="absolute inset-0">
        <BagButton />
        {/* The hall fills the screen. It is at least as wide as the screen and a little taller, so you pan to see all of it. */}
        <div ref={scroller} className="absolute inset-0 overflow-auto overscroll-contain [scrollbar-width:none]" style={{ containerType: "size" }}>
          <div style={{ width: "max(100cqw, 110cqh)" }}>
            <GuildHall
              fighters={fighters}
              rank={rank}
              decor={decor}
              edit={editing ? { carrying: !!carry, onPlace: placeCarried, onPick: pickUp } : undefined}
              onAction={onAction}
              highlight={step === 6 ? "jobs" : step === 8 && !panel ? (jobDone ? "jobs" : "adventure") : undefined}
              isLocked={(group) => firstJobOpen && !OPEN_DURING_FIRST_JOB.includes(group)}
              onBlocked={() => { setPanel(null); setNotice(FIRST_JOB_NOTICE); }}
            />
          </div>
        </div>

        {step >= 9 && !panel && (
          <div className="absolute bottom-2 right-2 z-[240] flex flex-col items-end gap-2">
            {editing && (
              <div className="pixel-box max-w-[min(92vw,34rem)] bg-night/95 p-2 text-base text-paper">
                {stored.length ? (
                  <>
                    <p className="mb-1 text-steel">{carry ? "Tap the floor to put it down." : "Pick a piece, then tap the floor. Tap a placed piece to pick it up."}</p>
                    <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                      {stored.map((d) => (
                        <button key={d.id} type="button" onClick={() => setCarry(carry === d.id ? null : d.id)} className={`pixel-box flex h-14 w-14 items-center justify-center bg-panel p-1 ${carry === d.id ? "outline outline-2 outline-gold" : ""}`} aria-label={d.slug} aria-pressed={carry === d.id}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/guild/props/${d.slug}.png`} alt="" draggable={false} className="max-h-full max-w-full [image-rendering:pixelated]" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-steel">Nothing in storage. Buy furniture from the Carpenter in the market. Tap a placed piece to pick it up.</p>
                )}
              </div>
            )}
            <PixelButton variant={editing ? "primary" : "ghost"} className="text-base" onClick={() => { setEditing(!editing); setCarry(null); }}>{editing ? "Done" : "Decorate"}</PixelButton>
          </div>
        )}

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
            <div className="pixel-box card-reveal max-h-[94dvh] w-full max-w-lg overflow-y-auto bg-night p-5 short:max-w-3xl short:p-3">
              {panel === "party" ? (
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
