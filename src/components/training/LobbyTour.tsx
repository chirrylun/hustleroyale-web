"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InfoBox } from "@/components/guild/InfoBox";
import { NpcPortrait } from "@/components/npc/Npc";

const STEPS: { title: string; body: string[] }[] = [
  { title: "The Main Lobby", body: ["This is the Main Lobby. Every guild comes through here, so you will see other players' fighters walking around.", "Tap the ground to walk, and tap a person or a sign to talk or travel. Let me show you who is who."] },
  { title: "The Arena", body: ["The Gladiator, to the west, runs the Arena. That is where your fighters test themselves against other guilds."] },
  { title: "The Class Changer", body: ["To the east stands the Class Changer. Recruits can take up a new class from level 20, and the Class Changer also moves fighters between classes."] },
  { title: "The Storage Keeper", body: ["Next to him, the Storage Keeper looks after your spare items. His boxes hold much more than your bag."] },
  { title: "The Marketplace", body: ["Follow the road south to the Marketplace. The Merchant sells potions, the Alchemist brews more from monster parts, and the Armourer sells weapons, shields and armour."] },
  { title: "Your guild", body: ["Your guild hall is north of here. Walk up the avenue to the Guild hall sign and tap it.", "That is where you take jobs, pick your party and head out to the floors. Good luck out there!"] },
];

/** The Guild Manager's walk-through of the lobby, shown once after training. */
export function LobbyTour() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const s = STEPS[i];
  const done = () => { setOpen(false); router.replace("/lobby"); };
  return (
    <div className="fixed inset-0 z-[9800] flex items-end justify-center bg-ink/50 p-3 sm:items-center" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()}>
      <InfoBox
        portrait={<NpcPortrait name="manager" still />} title={s.title} step={i} total={STEPS.length}
        onBack={i > 0 ? () => setI(i - 1) : undefined}
        onNext={i === STEPS.length - 1 ? done : () => setI(i + 1)} nextLabel={i === STEPS.length - 1 ? "Let's go" : "Next"}
      >
        {s.body.map((t, k) => <p key={k}>{t}</p>)}
      </InfoBox>
    </div>
  );
}
