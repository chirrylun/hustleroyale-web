import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FloorScreen } from "@/components/floor/FloorScreen";
import { loadFighters } from "@/lib/guild";
import { createClient } from "@/lib/supabase/server";
import { TRAINING_DONE } from "@/lib/training";
import { TRAINING_FLOOR, newSeed } from "@/lib/world/floor";

export default function TrainingPage({ searchParams }: { searchParams: Promise<{ room?: string; seed?: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-night" aria-busy="true" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

/** The training field: an open meadow shared with other new players, where the tutorial's quests happen. */
async function Content({ searchParams }: { searchParams: Promise<{ room?: string; seed?: string }> }) {
  await connection();
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("tutorial_step, training_step, training_kills, floor_unlocked").eq("id", user.id).single();
  if ((profile?.tutorial_step ?? 0) < 6 || (profile?.training_step ?? TRAINING_DONE) >= TRAINING_DONE) redirect("/home");
  const fighters = await loadFighters(supabase, user.id);
  if (!fighters.some((f) => f.team_slot > 0)) redirect("/home");
  return (
    <FloorScreen
      floorNo={TRAINING_FLOOR} seed={/^\d{1,10}$/.test(sp.seed ?? "") ? Math.min(2_147_483_647, Number(sp.seed)) : newSeed()}
      fighters={fighters} tutorialStep={profile?.tutorial_step ?? 6} floorUnlocked={1}
      roomCode={/^[A-Z2-9]{4,8}$/i.test(sp.room ?? "") ? sp.room!.toUpperCase() : undefined}
      training={{ step: profile?.training_step ?? 0, kills: profile?.training_kills ?? 0 }}
    />
  );
}
