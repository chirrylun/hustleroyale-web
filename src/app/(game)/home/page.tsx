import { Suspense } from "react";
import { redirect } from "next/navigation";
import { GuildScreen } from "@/components/guild/GuildScreen";
import { Tutorial } from "@/components/guild/Tutorial";
import { loadFighters } from "@/lib/guild";
import { createClient } from "@/lib/supabase/server";
import { connection } from "next/server";


/**
 * With `cacheComponents` on, anything that reads the request (cookies -> Supabase session)
 * must render inside a <Suspense> boundary, otherwise Next tries to prerender it and fails
 * with "unstable value Date.now()" from the auth client. The static shell renders instantly
 * and the player's data streams in.
 */
export default function HomePage() {
  return (
    <Suspense fallback={<HomeFallback />}>
      <HomeContent />
    </Suspense>
  );
}

async function HomeContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS lets a player read only their own row, so this cannot leak anyone else's data.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username, level, coins, starter_pack_opened, tutorial_step")
    .eq("id", user.id)
    .single();

  const fighters = await loadFighters(supabase, user.id);
  const step = profile?.tutorial_step ?? 0;
  const username = profile?.username ?? "hustler";

  // New players (and existing ones, once) walk through the tutorial; after that, the guild hall.
  if (step < 6) {
    return <Tutorial username={username} initialStep={step} fighters={fighters} />;
  }
  return <GuildScreen username={username} coins={profile?.coins ?? 0} level={profile?.level ?? 1} fighters={fighters} tutorialStep={step} />;
}

function HomeFallback() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6" aria-busy="true">
      <div className="h-10 w-2/3 animate-pulse bg-panel" />
      <div className="h-32 animate-pulse bg-panel" />
    </main>
  );
}
