"use client";

import { useEffect, useState, type ReactNode } from "react";
import { InfoBox } from "@/components/guild/InfoBox";
import { NpcPortrait, type NpcName } from "@/components/npc/Npc";
import { createClient } from "@/lib/supabase/client";

/**
 * A help box shown the first time something happens (the key is remembered on the player's profile, so it never repeats on any device).
 * `when` turns it on, for tips that wait for an event such as a wipe-out.
 */
export function FirstTip({ tip, title, who = "manager", when = true, children }: { tip: string; title: string; who?: NpcName; when?: boolean; children: ReactNode }) {
  const [state, setState] = useState<"unknown" | "new" | "seen">("unknown");
  useEffect(() => {
    let live = true;
    void createClient().from("profiles").select("tips_seen").single().then(({ data }) => {
      if (live) setState(((data?.tips_seen as string[] | null) ?? []).includes(tip) ? "seen" : "new");
    });
    return () => { live = false; };
  }, [tip]);
  if (state !== "new" || !when) return null;
  const close = () => { setState("seen"); void createClient().rpc("tip_seen", { p_key: tip }); };
  return (
    <div className="fixed inset-0 z-[9800] flex items-end justify-center bg-ink/60 p-3 sm:items-center" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onPointerMove={(e) => e.stopPropagation()}>
      <InfoBox portrait={<NpcPortrait name={who} still />} title={title} step={0} total={1} onNext={close} nextLabel="Got it">{children}</InfoBox>
    </div>
  );
}
