"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GearIcon } from "@/components/gear/GearIcon";
import { GearPreview } from "@/components/gear/GearPreview";
import { loadFighters, type GuildFighter } from "@/lib/guild";
import { ARCHETYPE_LABEL } from "@/lib/guild";
import { MAX_LEVEL, RANK_TEXT, SLOT_LABEL, classLabel, gearError, genderOf, minLevel, rankName, statLine, whyNot, type GearBase, type GearItem, type GearSlot } from "@/lib/gear";
import { createClient } from "@/lib/supabase/client";
import { LiveSprite } from "@/components/sprites/LiveSprite";
import { setLook } from "@/lib/lookStore";

const SLOTS: GearSlot[] = ["weapon", "offhand", "armor"];

/** Equipment for each fighter: three slots (weapon, shield, armour set). Gear is class- and level-gated by the database; this screen explains each "no". */
export function EquipmentTab({ guide = false, onWorn, onDone }: { guide?: boolean; onWorn?: (worn: boolean) => void; onDone?: () => void }) {
  const [fighters, setFighters] = useState<GuildFighter[] | null>(null);
  const [bases, setBases] = useState<GearBase[]>([]);
  const [items, setItems] = useState<GearItem[]>([]);
  const [worn, setWorn] = useState<{ fighter_id: string; slot: GearSlot; item_id: string }[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [slot, setSlot] = useState<GearSlot>("weapon");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<{ base: GearBase; rank: number; level: number } | null>(null);

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setError("Please sign in again."); return; }
    const [fs, t, inv, w] = await Promise.all([
      loadFighters(sb, user.id),
      sb.from("equipment_bases").select("*"),
      sb.from("gear_items").select("id, base_slug, rank, level, atk, def, magic, hp, spd").order("created_at"),
      sb.from("fighter_gear").select("fighter_id, slot, item_id"),
    ]);
    if (t.error || inv.error || w.error) { setError("Couldn't load your gear. Try again."); return; }
    setFighters(fs);
    setBases((t.data ?? []) as GearBase[]);
    setItems((inv.data ?? []) as GearItem[]);
    setWorn((w.data ?? []) as { fighter_id: string; slot: GearSlot; item_id: string }[]);
    onWorn?.((w.data ?? []).some((r) => r.slot === "armor"));
    setSel((cur) => cur ?? fs[0]?.id ?? null);
    return fs;
  }, [onWorn]);
  useEffect(() => { void load(); }, [load]);

  const baseOf = useMemo(() => new Map(bases.map((b) => [b.slug, b])), [bases]);
  const itemOf = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const fighter = fighters?.find((f) => f.id === sel) ?? null;
  const mine = worn.filter((w) => w.fighter_id === sel);
  const wearerOf = (id: string) => worn.find((w) => w.item_id === id)?.fighter_id ?? null;

  const call = async (p_item: string | null, p_slot: GearSlot | null) => {
    if (busy || !sel) return;
    setBusy(true); setError(null);
    const { error: e } = await createClient().rpc("gear_equip", { p_fighter: sel, p_item, p_slot });
    if (e) setError(gearError(e.message));
    const fs = await load();
    const f = fs?.find((x) => x.id === sel);
    if (f) setLook(f.id, f.template.sprite_key); // every screen redraws this fighter now
    setBusy(false);
  };

  if (fighters === null) return error ? <p role="alert" className="text-xl text-ember">{error}</p> : <div className="h-40 animate-pulse bg-panel" aria-busy="true" />;
  if (!fighters.length) return <p className="text-xl text-paper">No fighters yet.</p>;

  const bonus = mine.reduce((a, w) => { const i = itemOf.get(w.item_id); if (i) { a.atk += i.atk; a.def += i.def; a.magic += i.magic; a.hp += i.hp; a.spd += i.spd; } return a; }, { atk: 0, def: 0, magic: 0, hp: 0, spd: 0 });
  const bonusText = statLine(bonus);
  const inSlot = items.filter((i) => baseOf.get(i.base_slug)?.slot === slot);
  // Gear another fighter is wearing is not on offer here: take it off them first.
  const choices = inSlot.filter((i) => { const w = wearerOf(i.id); return !w || w === sel; }).sort((a, b) => b.rank - a.rank || b.level - a.level);

  // Walk-through for the first fighter: their tab, then Armour, then Equip, then close.
  const firstId = fighters[0]?.id;
  const firstWearing = worn.some((w) => w.fighter_id === firstId && w.slot === "armor");
  const firstChoice = choices.find((i) => { const b = baseOf.get(i.base_slug); return b && fighter && !whyNot(b, i.rank, fighter) && !mine.some((m) => m.item_id === i.id); });
  const step: "fighter" | "slot" | "equip" | "done" | null = !guide ? null : firstWearing ? "done" : sel !== firstId ? "fighter" : slot !== "armor" ? "slot" : "equip";
  const HINT = { fighter: "Tap the blinking name to pick your first fighter.", slot: "Now tap the blinking Armour box.", equip: "Tap the blinking Equip button to wear it.", done: "Well done! Your fighter is wearing it. Close this, then tell the Trainer. You can dress the others the same way." } as const;
  const blink = (on: boolean) => (on ? " tut-blink" : "");

  return (
    <div className="flex flex-col gap-2">
      {step && <p className="bg-gold/90 px-3 py-1 text-center text-base text-ink">{HINT[step]}</p>}
      {step === "done" && onDone && <button type="button" onClick={onDone} className="tut-blink bg-leaf px-3 py-1 text-xl uppercase text-ink">Close</button>}
      <div className="flex flex-wrap gap-1">
        {fighters.map((f) => (
          <button key={f.id} type="button" onClick={() => setSel(f.id)} className={`px-2 py-0.5 text-lg ${sel === f.id ? "bg-gold text-ink" : "bg-panel text-paper"}${blink(step === "fighter" && f.id === firstId)}`}>{f.template.name}</button>
        ))}
      </div>
      {fighter && (
        <div className="flex items-center gap-2">
          <div className="h-20 w-20 shrink-0 bg-panel"><LiveSprite id={fighter.id} spriteKey={fighter.template.sprite_key} role={fighter.template.role} still /></div>
          <p className="min-w-0 text-base text-steel">{ARCHETYPE_LABEL[fighter.template.archetype] ?? fighter.template.archetype} · Lv {fighter.level}{bonusText && <span className="text-leaf"> · Gear: {bonusText}</span>}</p>
        </div>
      )}
      {error && <p role="alert" className="text-lg text-ember">{error}</p>}
      <div className="grid grid-cols-3 gap-1.5">
        {SLOTS.map((s) => {
          const w = mine.find((m) => m.slot === s);
          const it = w ? itemOf.get(w.item_id) : null;
          const b = it ? baseOf.get(it.base_slug) : null;
          return (
            <button key={s} type="button" onClick={() => setSlot(s)} className={`pixel-box flex flex-col items-center gap-1 p-1.5 text-center ${slot === s ? "bg-night ring-2 ring-gold" : "bg-panel"}${blink(step === "slot" && s === "armor")}`}>
              <span className="text-sm uppercase text-steel">{SLOT_LABEL[s]}</span>
              {it && b ? <GearIcon base={b.slug} kind={b.kind} rank={it.rank} /> : <span className="flex h-10 w-10 items-center justify-center border-2 border-dashed border-steel/50 text-steel">–</span>}
              <span className={`w-full truncate text-sm ${it ? RANK_TEXT[it.rank] : "text-steel"}`}>{it && b ? `${b.name} · R${it.rank} L${it.level}` : "Empty"}</span>
            </button>
          );
        })}
      </div>
      <div className="max-h-[34dvh] space-y-1.5 overflow-y-auto pr-1 short:max-h-[26dvh]">
        {choices.length === 0 ? <p className="text-lg text-paper">{inSlot.length > 0 ? `All your ${SLOT_LABEL[slot].toLowerCase()} gear is on other fighters. Take it off them to use it here.` : `You don't own any ${SLOT_LABEL[slot].toLowerCase()} gear. The armourer in the market sells it.`}</p>
          : choices.map((i) => {
            const b = baseOf.get(i.base_slug);
            if (!b) return null;
            const here = mine.some((m) => m.item_id === i.id);
            const why = fighter ? whyNot(b, i.rank, fighter) : null;
            return (
              <div key={i.id} className="pixel-box flex items-center gap-2 bg-panel p-1.5">
                <GearIcon base={b.slug} kind={b.kind} rank={i.rank} />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-xl text-paper">{b.name}</p>
                  <p className="truncate text-base text-steel"><span className={RANK_TEXT[i.rank]}>{rankName(i.rank)}</span> · Lv {i.level}/{MAX_LEVEL} · wear at Lv {minLevel(i.rank)}+ · {classLabel(b)}</p>
                  <p className="truncate text-base text-leaf">{statLine(i)}</p>
                  {here ? <p className="truncate text-sm text-leaf">Worn by {fighter?.template.name}</p> : why ? <p className="truncate text-sm text-ember">{why}</p> : null}
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  {here
                    ? <button type="button" disabled={busy} onClick={() => call(null, slot)} className="bg-gold px-3 py-1 text-xl uppercase text-ink disabled:opacity-40">Unequip</button>
                    : <button type="button" disabled={busy || !!why} onClick={() => call(i.id, null)} className={`bg-leaf px-3 py-1 text-xl uppercase text-ink disabled:opacity-40${blink(step === "equip" && i.id === firstChoice?.id)}`}>Equip</button>}
                  <button type="button" onClick={() => setView({ base: b, rank: i.rank, level: i.level })} className="bg-night px-3 py-0.5 text-base uppercase text-paper">View</button>
                </div>
              </div>
            );
          })}
      </div>
      {view && <GearPreview base={view.base} rank={view.rank} level={view.level} gender={genderOf(fighter)} onClose={() => setView(null)} />}
    </div>
  );
}
