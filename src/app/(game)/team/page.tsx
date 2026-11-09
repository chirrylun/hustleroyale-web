import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { FighterCard } from "@/components/pack/FighterCard";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { createClient } from "@/lib/supabase/server";
import type { StarterFighter } from "@/lib/starter-pack";

export default function TeamPage() {
  return (
    <PageShell title="My Fighters">
      <Suspense fallback={<div className="h-64 animate-pulse bg-panel" aria-busy="true" />}>
        <Fighters />
      </Suspense>
    </PageShell>
  );
}

interface Row {
  id: string;
  grade: StarterFighter["grade"];
  level: number;
  team_slot: number | null;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stamina: number;
  magic: number;
  template: StarterFighter["template"];
  fighter_skills: { slot: number; skill: { name: string } | null }[] | null;
}

async function Fighters() {
  await connection(); // keeps the Supabase session check at request time
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // RLS only returns this player's own fighters.
  const { data } = await supabase
    .from("fighters")
    .select(
      "id, grade, level, team_slot, hp, atk, def, spd, stamina, magic, template:fighter_templates(name, role, archetype, rarity, sprite_key), fighter_skills(slot, skill:skills(name))",
    )
    .eq("owner_id", user.id)
    .order("team_slot", { ascending: true, nullsFirst: false });

  const fighters: StarterFighter[] = ((data ?? []) as unknown as Row[]).map((f) => ({
    id: f.id,
    grade: f.grade,
    level: f.level,
    team_slot: f.team_slot ?? 0,
    hp: f.hp,
    atk: f.atk,
    def: f.def,
    spd: f.spd,
    stamina: f.stamina,
    magic: f.magic,
    template: f.template,
    skills: (f.fighter_skills ?? [])
      .map((s) => ({ slot: s.slot, name: s.skill?.name ?? "" }))
      .sort((a, b) => a.slot - b.slot),
  }));

  if (fighters.length === 0) {
    return (
      <PixelPanel title="No fighters yet">
        <p className="text-xl text-paper">Open your starter pack on the home page to get your first three fighters.</p>
        <Link href="/home" className="pixel-btn mt-4 inline-block bg-leaf px-4 py-2 text-xl uppercase text-ink">
          Go to home
        </Link>
      </PixelPanel>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {fighters.map((f, i) => (
        <FighterCard key={f.id} fighter={f} delayMs={i * 120} />
      ))}
    </div>
  );
}
