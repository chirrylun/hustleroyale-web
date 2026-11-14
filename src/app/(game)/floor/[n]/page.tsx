import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { FloorScreen } from "@/components/floor/FloorScreen";
import { loadFighters } from "@/lib/guild";
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
  const { data: profile } = await supabase.from("profiles").select("floor_cleared, tutorial_step").eq("id", user.id).single();
  // Floors unlock one at a time.
  if (n > (profile?.floor_cleared ?? 0) + 1) redirect("/home");
  const fighters = await loadFighters(supabase, user.id);
  return <FloorScreen floorNo={n} fighters={fighters} tutorialStep={profile?.tutorial_step ?? 0} />;
}
