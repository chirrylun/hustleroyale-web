import clsx from "clsx";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { ARCHETYPE_LABEL } from "@/lib/guild";
import type { Role, StarterFighter } from "@/lib/starter-pack";

const ROLE: Record<Role, { label: string; bg: string }> = { tank: { label: "Tank", bg: "bg-sky" }, healer: { label: "Healer", bg: "bg-leaf" }, dps: { label: "Damage", bg: "bg-ember" } };

/** A small fighter card for the arena: a still portrait, name, class and level, and the three numbers that decide a fight. */
export function MiniFighter({ fighter }: { fighter: StarterFighter }) {
  const t = fighter.template;
  return (
    <article className="pixel-box flex min-w-0 items-center gap-2 bg-night p-1.5" aria-label={`${t.name}, level ${fighter.level}`}>
      <div className="relative h-16 w-16 shrink-0 overflow-hidden bg-ink" aria-hidden="true">
        <div className="absolute inset-x-0 -bottom-1 scale-[1.25]"><FighterSprite spriteKey={t.sprite_key} role={t.role} still /></div>
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1">
          <span className={clsx("px-1 text-xs uppercase leading-4 text-ink", ROLE[t.role].bg)}>{ROLE[t.role].label}</span>
          <span className="text-sm text-gold">Lv {fighter.level}</span>
        </div>
        <p className="truncate text-lg uppercase text-paper">{t.name}</p>
        <p className="truncate text-sm text-steel">{ARCHETYPE_LABEL[t.archetype] ?? t.role} · HP {fighter.hp} · ATK {fighter.atk} · DEF {fighter.def}</p>
      </div>
    </article>
  );
}
