import { Suspense } from "react";
import { lookKey, type WornRows } from "@/lib/look";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ArenaScreen, type ArenaRequest, type TeamFighter } from "@/components/battle/ArenaScreen";
import { PageShell } from "@/components/layout/PageShell";
import { RANGES } from "@/lib/arena";
import type { BossId } from "@/lib/battle";
import { createClient } from "@/lib/supabase/server";

/** Same pattern as /home: request data (the session) is read inside <Suspense> so the shell prerenders. */
export default function FightPage({ searchParams }: { searchParams: Promise<{ mode?: string; range?: string; boss?: string }> }) {
  return (
    <PageShell title="The Arena" music={false}>
      <Suspense fallback={<div className="h-64 animate-pulse bg-panel" aria-busy="true" />}>
        <ArenaContent searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

/** What the arena map sent us here to fight: a mode, a level range and (for Boss Rush) a boss. Anything else goes back to the map. */
function requestOf(q: { mode?: string; range?: string; boss?: string }): ArenaRequest | null {
  const range = RANGES.find((r) => r.id === q.range);
  if (!range) return null;
  if (q.mode === "challenge") return { mode: "challenge", range: range.id };
  if (q.mode === "pvp") return { mode: "pvp", range: range.id };
  if (q.mode === "raid") return { mode: "raid", range: range.id, controlledFighterId: null };
  if (q.mode === "boss" && range.bosses.some((b) => b === q.boss)) return { mode: "boss", range: range.id, boss: q.boss as BossId, controlledFighterId: null };
  return null;
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
  gender?: string;
  gear?: WornRows;
  template: TeamFighter["template"] | TeamFighter["template"][] | null;
  skills: { slot: number; skill: { name: string } | { name: string }[] | null }[] | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

async function ArenaContent({ searchParams }: { searchParams: Promise<{ mode?: string; range?: string; boss?: string }> }) {
  await connection();
  const request = requestOf(await searchParams);
  if (!request) redirect("/arena");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from("profiles").select("starter_pack_opened").eq("id", user.id).single(),
    // RLS only returns this player's own fighters.
    supabase
      .from("fighters")
      .select(
        "id, grade, level, team_slot, hp, atk, def, spd, stamina, magic, gender, template:fighter_templates(name, role, archetype, rarity, sprite_key), skills:fighter_skills(slot, skill:skills(name)), gear:fighter_gear(slot, item:gear_items(base_slug, rank))",
      )
      .not("team_slot", "is", null)
      .order("team_slot", { ascending: true })
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
        template: { ...template, sprite_key: lookKey(r.gender, r.gear) },
        skills: [...(r.skills ?? [])]
          .sort((a, b) => a.slot - b.slot)
          .flatMap((s) => {
            const skill = one(s.skill);
            return skill ? [{ slot: s.slot, name: skill.name }] : [];
          }),
      },
    ];
  });

  return <ArenaScreen team={team} request={request!} />;
}
