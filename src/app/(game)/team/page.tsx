import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { FighterCard } from "@/components/pack/FighterCard";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { createClient } from "@/lib/supabase/server";
import { ROSTER_CAP, loadFighters } from "@/lib/guild";
import { ClassActions } from "@/components/guild/ClassActions";

export default function TeamPage() {
  return (
    <PageShell title="My Fighters">
      <Suspense fallback={<div className="h-64 animate-pulse bg-panel" aria-busy="true" />}>
        <Fighters />
      </Suspense>
    </PageShell>
  );
}

async function Fighters() {
  await connection(); // keeps the Supabase session check at request time
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const fighters = await loadFighters(supabase, user.id);

  if (fighters.length === 0) {
    return (
      <PixelPanel title="No fighters yet">
        <p className="text-xl text-paper">Finish the tutorial on the home page to get your first three fighters.</p>
        <Link href="/home" className="pixel-btn mt-4 inline-block bg-leaf px-4 py-2 text-xl uppercase text-ink">
          Go to home
        </Link>
      </PixelPanel>
    );
  }

  return (
    <>
      <p className="text-xl text-steel">
        Guild roster: <span className="text-gold">{fighters.length}</span> / {ROSTER_CAP} fighters
      </p>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {fighters.map((f, i) => (
          <div key={f.id} className="flex flex-col gap-3">
            <FighterCard fighter={f} delayMs={i * 120} />
            <Link href={`/team/${f.id}`} className="pixel-btn bg-panel px-3 py-1 text-center text-lg uppercase text-paper">Skills ({f.skill_points ?? 0} points)</Link>
            <ClassActions id={f.id} level={f.level} role={f.template.role} archetype={f.template.archetype} rarity={f.template.rarity} />
          </div>
        ))}
      </div>
    </>
  );
}
