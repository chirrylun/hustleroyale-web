import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SkillManager, type NodeRow, type SkillInfo } from "@/components/guild/SkillManager";
import { PageShell } from "@/components/layout/PageShell";
import { createClient } from "@/lib/supabase/server";

export default function FighterPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PageShell title="Fighter skills">
      <Suspense fallback={<div className="h-64 animate-pulse bg-panel" aria-busy="true" />}>
        <Content params={params} />
      </Suspense>
    </PageShell>
  );
}

const SKILL = "id, slug, name, description, kind, damage_type, power, cooldown_ms, stamina_cost, is_basic, source, min_level, price, class_archetype, roles";

async function Content({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: f } = await supabase
    .from("fighters")
    .select("id, level, skill_points, template:fighter_templates(name, role, archetype)")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!f) notFound();
  const t = (Array.isArray(f.template) ? f.template[0] : f.template) as { name: string; role: string; archetype: string };

  const [equipped, learned, nodes, owned, stock, shop, profile] = await Promise.all([
    supabase.from("fighter_skills").select(`slot, skill:skills(${SKILL})`).eq("fighter_id", id),
    supabase.from("fighter_learned").select(`level, uses, skill:skills(${SKILL})`).eq("fighter_id", id),
    supabase.from("skill_nodes").select("id, branch, tier, name, description, min_level, cost, requires, skill_id, boost").eq("archetype", t.archetype).order("tier"),
    supabase.from("fighter_nodes").select("node_id").eq("fighter_id", id),
    supabase.from("skill_book_stock").select("skill_id, qty").eq("owner_id", user.id),
    supabase.from("skills").select(SKILL).eq("source", "book").not("price", "is", null),
    supabase.from("profiles").select("coins").eq("id", user.id).single(),
  ]);

  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v) as T;
  return (
    <>
      <Link href="/team" className="text-xl text-steel underline">Back to roster</Link>
      <SkillManager
        fighter={{ id: f.id, name: t.name, role: t.role, archetype: t.archetype, level: f.level, points: f.skill_points }}
        equipped={(equipped.data ?? []).map((e) => ({ slot: e.slot, skill: one(e.skill as SkillInfo | SkillInfo[]) }))}
        learned={(learned.data ?? []).map((l) => ({ level: l.level, uses: l.uses, skill: one(l.skill as SkillInfo | SkillInfo[]) }))}
        nodes={(nodes.data ?? []) as NodeRow[]}
        ownedNodes={(owned.data ?? []).map((o) => o.node_id)}
        stock={Object.fromEntries((stock.data ?? []).map((s) => [s.skill_id, s.qty]))}
        shop={((shop.data ?? []) as SkillInfo[]).filter((s) => !s.roles || s.roles.includes(t.role))}
        coins={profile.data?.coins ?? 0}
      />
    </>
  );
}
