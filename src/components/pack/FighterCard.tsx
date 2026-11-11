import clsx from "clsx";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import type { Rarity, Role, StarterFighter } from "@/lib/starter-pack";

const rarityStyle: Record<Rarity, { border: string; text: string; glow: string }> = {
  common: { border: "border-steel", text: "text-steel", glow: "" },
  uncommon: { border: "border-leaf", text: "text-leaf", glow: "" },
  rare: { border: "border-sky", text: "text-sky", glow: "shadow-[0_0_24px_var(--sky)]" },
  legendary: { border: "border-gold", text: "text-gold", glow: "shadow-[0_0_32px_var(--gold)]" },
};

const roleTag: Record<Role, { label: string; bg: string }> = {
  tank: { label: "Tank", bg: "bg-sky" },
  healer: { label: "Healer", bg: "bg-leaf" },
  dps: { label: "Damage", bg: "bg-ember" },
};

const STATS = ["hp", "atk", "def", "spd", "stamina", "magic"] as const;

export function FighterCard({ fighter, delayMs }: { fighter: StarterFighter; delayMs: number }) {
  const { template: t } = fighter;
  const r = rarityStyle[t.rarity];
  return (
    <article
      className={clsx("pixel-box card-reveal flex flex-col gap-3 bg-night p-4", r.glow)}
      style={{ animationDelay: `${delayMs}ms` }}
      aria-label={`${t.name}, ${t.rarity} ${t.role}`}
    >
      <div className="flex items-center justify-between text-sm uppercase">
        <span className={clsx("px-2 py-0.5 text-ink", roleTag[t.role].bg)}>{roleTag[t.role].label}</span>
        <span className={r.text}>{t.rarity}</span>
      </div>

      <div
        className={clsx("relative flex aspect-square items-end justify-center overflow-hidden border-4", r.border)}
        style={{ background: "radial-gradient(ellipse at 50% 88%, rgba(148,176,194,0.35), transparent 62%), linear-gradient(#333c57, #1a1c2c)" }}
        data-sprite={t.sprite_key}
        aria-hidden="true"
      >
        {/* Ground shadow, then the fighter scaled up around its feet so it fills the portrait. */}
        <div className="absolute bottom-[7%] left-1/2 h-[6%] w-[44%] -translate-x-1/2 rounded-[50%] bg-black/45" />
        <div className="relative w-full origin-[50%_90%] scale-[1.15]">
          <FighterSprite spriteKey={t.sprite_key} role={t.role} still />
        </div>
      </div>

      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-2xl uppercase leading-tight text-paper">{t.name}</h3>
        <span className="text-xl text-gold" title="Grade">
          {fighter.grade}
        </span>
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-base">
        {STATS.map((s) => (
          <div key={s}>
            <dt className="text-xs uppercase text-steel">{s}</dt>
            <dd className="text-paper">{fighter[s]}</dd>
          </div>
        ))}
      </dl>

      {fighter.skills.length > 0 && (
        <ul className="border-t-4 border-panel pt-2 text-sm text-steel">
          {fighter.skills.map((s) => (
            <li key={s.slot}>
              {s.slot}. {s.name}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
