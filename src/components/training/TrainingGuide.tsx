"use client";

import { useEffect, useState } from "react";
import { Npc } from "@/components/npc/Npc";
import { InfoBox } from "@/components/guild/InfoBox";

interface Tip { who: "manager" | "trainer"; title: string; body: string[] }
/** Help boxes that appear the first time each part of the training field starts: who to talk to, which icon to press. */
const TIPS: Record<number, Tip> = {
  0: { who: "manager", title: "The training field", body: ["Tap the ground to walk. Tap a person to walk up and talk to them.", "Start with the Guild Manager. A gold arrow ▼ floats over whoever you should speak to next."] },
  1: { who: "trainer", title: "The Trainer", body: ["Walk up to the Trainer, the soldier with the spear, and tap him. He sets you tasks, and the goal is always shown along the top of the screen."] },
  2: { who: "trainer", title: "Your first fight", body: ["Tap a slime and your party attacks it. Slimes here only fight back if you hit them.", "The three buttons on the left change how your party behaves in a fight."] },
  3: { who: "trainer", title: "Levelling up", body: ["Keep fighting slimes. Every kill earns experience for the whole party.", "Tap the Fighters button on the left to see each fighter's level. Everyone needs level 5."] },
  4: { who: "trainer", title: "Shortcut slots", body: ["Tap the Bag button on the left to see your potions.", "Then tap an empty slot along the bottom of the screen and pick a potion. One tap on a slot drinks it in a fight."] },
  5: { who: "trainer", title: "Pick a calling", body: ["Walk to the Class Changer and tap them. At level 5 each Novice can become a Recruit of their role, for free.", "Recruits learn new skills, and later classes build on them."] },
  6: { who: "manager", title: "Training complete", body: ["Go back to the Guild Manager. He will take you to the Main Lobby."] },
};
const key = (s: number) => `hr_train_tip_${s}`;
const seen = (s: number) => { try { return localStorage.getItem(key(s)) === "1"; } catch { return false; } };

export function TrainingGuide({ step, paused }: { step: number; paused: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { const t = setTimeout(() => setOpen(TIPS[step] && !seen(step) ? step : null), 0); return () => clearTimeout(t); }, [step]);
  const tip = open !== null ? TIPS[open] : null;
  if (!tip || paused) return null;
  const close = () => { try { localStorage.setItem(key(open!), "1"); } catch { /* ignore */ } setOpen(null); };
  return (
    <div className="absolute inset-x-0 bottom-20 z-[9650] flex justify-center px-3 short:bottom-12" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
      <InfoBox portrait={<Npc name={tip.who === "manager" ? "manager" : "trainer"} className="w-14 short:w-10" />} title={tip.title} step={0} total={1} onNext={close} nextLabel="Got it">
        {tip.body.map((t, i) => <p key={i}>{t}</p>)}
      </InfoBox>
    </div>
  );
}
