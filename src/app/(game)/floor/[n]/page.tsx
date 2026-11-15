import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FloorScreen } from "@/components/floor/FloorScreen";
import { loadFighters } from "@/lib/guild";
import { loadFloorQuests } from "@/lib/quests";
import { createClient } from "@/lib/supabase/server";
import { MAX_FLOOR } from "@/lib/world/floor";

export default function FloorPage({ params }: { params: Promise<{ n: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-night" aria-busy="true" />}>
      <Content params={params} />
    </Suspense>
  );
}

async function Content({ params }: { params: Promise<{ n: string }> }) {
  await connection();
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1 || n > MAX_FLOOR) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await supabase.from("profiles").select("floor_unlocked, tutorial_step").eq("id", user.id).single();
  // Floors open through quests on the job board, not by walking past them.
  const floorUnlocked = profile?.floor_unlocked ?? 1;
  if (n > floorUnlocked) redirect("/home");
  const [fighters, tracker] = await Promise.all([loadFighters(supabase, user.id), loadFloorQuests(supabase, user.id, n)]);
  return (
    <FloorScreen
      floorNo={n} fighters={fighters} tutorialStep={profile?.tutorial_step ?? 0}
      floorUnlocked={floorUnlocked} quests={tracker.quests} pack={tracker.pack}
    />
  );
}
