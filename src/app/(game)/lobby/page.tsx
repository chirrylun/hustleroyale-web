import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TownMap } from "@/components/town/TownMap";
import { loadFighters } from "@/lib/guild";
import { createClient } from "@/lib/supabase/server";

export default function LobbyPage({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-night" aria-busy="true" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ tour?: string }> }) {
  await connection();
  const sp = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const fighters = await loadFighters(supabase, user.id);
  if (!fighters.length) redirect("/home");
  return <TownMap id="lobby" fighters={fighters} tour={sp.tour === "1"} />;
}
