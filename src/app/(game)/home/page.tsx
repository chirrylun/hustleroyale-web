import { Suspense } from "react";
import { redirect } from "next/navigation";
import { HomeDashboard } from "@/components/home/HomeDashboard";
import { StarterPackExperience } from "@/components/pack/StarterPackExperience";
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
    .select("username, level, coins, rating, wins, losses, starter_pack_opened")
    .eq("id", user.id)
    .single();

  // First visit: welcome banner + starter pack. Once opened, the server component re-renders
  // (router.refresh) with the flag set and the normal home screen takes over.
  if (profile && !profile.starter_pack_opened) {
    return <StarterPackExperience username={profile.username} />;
  }

  return (
    <HomeDashboard
      profile={{
        username: profile?.username ?? "hustler",
        level: profile?.level ?? 1,
        coins: profile?.coins ?? 0,
        rating: profile?.rating ?? 0,
        wins: profile?.wins ?? 0,
        losses: profile?.losses ?? 0,
      }}
    />
  );
}

function HomeFallback() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6" aria-busy="true">
      <div className="h-10 w-2/3 animate-pulse bg-panel" />
      <div className="h-32 animate-pulse bg-panel" />
    </main>
  );
}
