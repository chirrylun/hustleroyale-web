"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/gear/GearIcon";
import { loadFighters, type GuildFighter } from "@/lib/guild";
import { ARCHETYPE_LABEL } from "@/lib/guild";
import { RANK_NAME, RANK_TEXT, SLOT_LABEL, classLabel, gearError, statLine, whyNot, type GearItem, type GearSlot } from "@/lib/gear";
import { createClient } from "@/lib/supabase/client";

const SLOTS: GearSlot[] = ["weapon", "offhand", "armor"];

/** Equipment for each fighter: three slots (weapon, shield, armour set). Gear is class- and level-gated by the database; this screen explains each "no". */
export function EquipmentTab() {
  const [fighters, setFighters] = useState<GuildFighter[] | null>(null);
  const [items, setItems] = useState<GearItem[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [worn, setWorn] = useState<{ fighter_id: string; slot: GearSlot; item_slug: string }[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [slot, setSlot] = useState<GearSlot>("weapon");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setError("Please sign in again."); return; }
    const [fs, t, inv, w] = await Promise.all([
      loadFighters(sb, user.id),
      sb.from("equipment_templates").select("*"),
      sb.from("player_gear").select("item_slug, qty"),
      sb.from("fighter_gear").select("fighter_id, slot, item_slug"),
    ]);
    if (t.error || inv.error || w.error) { setError("Couldn't load your gear. Try again."); return; }
    setFighters(fs);
    setItems((t.data ?? []) as GearItem[]);
    setOwned(Object.fromEntries((inv.data ?? []).map((r) => [r.item_slug as string, r.qty as number])));
    setWorn((w.data ?? []) as { fighter_id: string; slot: GearSlot; item_slug: string }[]);
    setSel((cur) => cur ?? fs[0]?.id ?? null);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const bySlug = useMemo(() => new Map(items.map((i) => [i.slug, i])), [items]);
  const fighter = fighters?.find((f) => f.id === sel) ?? null;
  const mine = worn.filter((w) => w.fighter_id === sel);
  const wornTotal = (slug: string) => worn.filter((w) => w.item_slug === slug).length;

  const call = async (p_slug: string | null, p_slot: GearSlot | null) => {
    if (busy || !sel) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("gear_equip", { p_fighter: sel, p_slug, p_slot });
    if (e) setError(gearError(e.message));
    await load();
    setBusy(false);
  };

  if (fighters === null) return error ? <p role="alert" className="text-xl text-ember">{error}</p> : <div className="h-40 animate-pulse bg-panel" aria-busy="true" />;
  if (!fighters.length) return <p className="text-xl text-paper">No fighters yet.</p>;

  const bonus = mine.reduce((a, w) => { const i = bySlug.get(w.item_slug); if (i) { a.atk += i.atk; a.def += i.def; a.magic += i.magic; a.hp += i.hp; a.spd += i.spd; } return a; }, { atk: 0, def: 0, magic: 0, hp: 0, spd: 0 });
  const bonusText = statLine({ ...bonus } as GearItem);
  const choices = items.filter((i) => i.slot === slot && (owned[i.slug] ?? 0) > 0).sort((a, b) => a.sort - b.sort);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1">
        {fighters.map((f) => (
          <button key={f.id} type="button" onClick={() => setSel(f.id)} className={`px-2 py-0.5 text-lg ${sel === f.id ? "bg-gold text-ink" : "bg-panel text-paper"}`}>{f.template.name}</button>
        ))}
      </div>
      {fighter && <p className="text-base text-steel">{ARCHETYPE_LABEL[fighter.template.archetype] ?? fighter.template.archetype} · Lv {fighter.level}{bonusText && <span className="text-leaf"> · Gear: {bonusText}</span>}</p>}
      {error && <p role="alert" className="text-lg text-ember">{error}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {SLOTS.map((s) => {
          const w = mine.find((m) => m.slot === s);
          const it = w ? bySlug.get(w.item_slug) : null;
          return (
            <button key={s} type="button" onClick={() => setSlot(s)} className={`pixel-box flex flex-col items-center gap-1 p-1.5 text-center ${slot === s ? "bg-night ring-2 ring-gold" : "bg-panel"}`}>
              <span className="text-sm uppercase text-steel">{SLOT_LABEL[s]}</span>
              {it ? <GearIcon kind={it.kind} rank={it.rank} /> : <span className="flex h-10 w-10 items-center justify-center border-2 border-dashed border-steel/50 text-steel">–</span>}
              <span className={`w-full truncate text-sm ${it ? RANK_TEXT[it.rank] : "text-steel"}`}>{it ? it.name : "Empty"}</span>
            </button>
          );
        })}
      </div>
      {mine.find((m) => m.slot === slot) && (
        <button type="button" disabled={busy} onClick={() => call(null, slot)} className="self-start bg-night px-2 py-0.5 text-base uppercase text-gold disabled:opacity-40">Take off {SLOT_LABEL[slot].toLowerCase()}</button>
      )}
      <div className="max-h-[34dvh] space-y-1.5 overflow-y-auto pr-1 short:max-h-[26dvh]">
        {choices.length === 0 ? <p className="text-lg text-paper">You don&apos;t own any {SLOT_LABEL[slot].toLowerCase()} gear. The armourer in the market sells it.</p>
          : choices.map((i) => {
            const here = mine.some((m) => m.item_slug === i.slug);
            const why = fighter ? whyNot(i, fighter) : null;
            const spare = (owned[i.slug] ?? 0) - wornTotal(i.slug);
            const blocked = why ?? (spare < 1 && !here ? "All copies are worn by other fighters" : null);
            return (
              <div key={i.slug} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <GearIcon kind={i.kind} rank={i.rank} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{i.name}<span className="ml-1 text-base text-steel">×{owned[i.slug]}</span></p>
                  <p className="truncate text-base text-steel"><span className={RANK_TEXT[i.rank]}>{RANK_NAME[i.rank]}</span> · Lv {i.min_level}+ · {classLabel(i)}</p>
                  <p className="truncate text-base text-leaf">{statLine(i)}</p>
                  {blocked && <p className="truncate text-sm text-ember">{blocked}</p>}
                </div>
                <button type="button" disabled={busy || !!blocked || here} onClick={() => call(i.slug, null)} className="shrink-0 bg-leaf px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">{here ? "Worn" : "Equip"}</button>
              </div>
            );
          })}
      </div>
    </div>
  );
}
