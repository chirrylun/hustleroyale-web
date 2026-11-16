import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TownMap } from "@/components/town/TownMap";
import { loadFighters } from "@/lib/guild";
import { createClient } from "@/lib/supabase/server";
import type { TownId } from "@/lib/town/maps";

/** The page body shared by the lobby and the marketplace: sign-in check, the player's fighters, the map. */
export function TownPage({ id }: { id: TownId }) {
  return (
    <Suspense fallback={<div className="h-dvh animate-pulse bg-night" aria-busy="true" />}>
      <Content id={id} />
    </Suspense>
  );
}

async function Content({ id }: { id: TownId }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const fighters = await loadFighters(supabase, user.id);
  if (!fighters.length) redirect("/home");
  return <TownMap id={id} fighters={fighters} />;
}
