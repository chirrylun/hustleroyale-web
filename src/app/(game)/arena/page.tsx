import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArenaScreen, type TeamFighter } from "@/components/battle/ArenaScreen";
import { PageShell } from "@/components/layout/PageShell";
import { createClient } from "@/lib/supabase/server";

/** Same pattern as /home: request data (the session) is read inside <Suspense> so the shell prerenders. */
export default function ArenaPage() {
  return (
    <PageShell title="Find a Match">
      <Suspense fallback={<div className="h-64 animate-pulse bg-panel" aria-busy="true" />}>
        <ArenaContent />
      </Suspense>
    </PageShell>
  );
}

type Row = {
  id: string;
  grade: TeamFighter["grade"];
  level: number;
  team_slot: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stamina: number;
  magic: number;
  template: TeamFighter["template"] | TeamFighter["template"][] | null;
  skills: { slot: number; skill: { name: string } | { name: string }[] | null }[] | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function ArenaContent() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: rows }, { data: ledger }] = await Promise.all([
    supabase.from("profiles").select("coins, starter_pack_opened").eq("id", user.id).single(),
    // RLS only returns this player's own fighters.
    supabase
      .from("fighters")
      .select(
        "id, grade, level, team_slot, hp, atk, def, spd, stamina, magic, template:fighter_templates(name, role, archetype, rarity, sprite_key), skills:fighter_skills(slot, skill:skills(name))",
      )
      .not("team_slot", "is", null)
      .order("team_slot", { ascending: true }),
    supabase
      .from("coin_ledger")
      .select("amount")
      .eq("reason", "solo_match")
      .gte("created_at", startOfUtcDay()),
  ]);

  // New players open their starter pack on /home first.
  if (profile && !profile.starter_pack_opened) redirect("/home");

  const team: TeamFighter[] = ((rows ?? []) as unknown as Row[]).flatMap((r) => {
    const template = one(r.template);
    if (!template) return [];
    return [
      {
        id: r.id,
        grade: r.grade,
        level: r.level,
        team_slot: r.team_slot,
        hp: r.hp,
        atk: r.atk,
        def: r.def,
        spd: r.spd,
        stamina: r.stamina,
        magic: r.magic,
        template,
        skills: [...(r.skills ?? [])]
          .sort((a, b) => a.slot - b.slot)
          .flatMap((s) => {
            const skill = one(s.skill);
            return skill ? [{ slot: s.slot, name: skill.name }] : [];
          }),
      },
    ];
  });

  const earnedToday = (ledger ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return <ArenaScreen team={team} coins={Number(profile?.coins ?? 0)} earnedToday={earnedToday} />;
}

function startOfUtcDay(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}
