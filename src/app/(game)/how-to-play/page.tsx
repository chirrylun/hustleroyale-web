import { PageShell } from "@/components/layout/PageShell";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { FighterSprite } from "@/components/sprites/FighterSprite";

export const metadata = { title: "How to Play | Hustle Royale" };

const JOBS = [
  { sprite: "danfo_guard", role: "tank", name: "Tank", color: "bg-sky", text: "Big and tough. A tank stands in front and takes the hits so your team stays safe." },
  { sprite: "herbal_hawker", role: "healer", name: "Healer", color: "bg-leaf", text: "A healer gives health back to hurt friends. Keep your healer alive!" },
  { sprite: "street_scrapper", role: "dps", name: "Damage", color: "bg-ember", text: "A damage fighter hits the enemy really hard. It is not very tough, so protect it." },
] as const;

const STEPS = [
  "Open your starter pack to get three fighters: a tank, a healer and a damage fighter.",
  "Press Find a Match to fight another player.",
  "In a match, both teams of three fight. Fighters attack on their own.",
  "You control one fighter. Use its special moves at the right time to help your team.",
  "Knock out all the enemy fighters to win.",
  "Winning gives you coins and a higher score on the leaderboard.",
  "Spend coins on training to make your fighters stronger, or buy new fighters in the marketplace.",
];

export default function HowToPlayPage() {
  return (
    <PageShell title="How to Play">
      <PixelPanel title="Every team has three jobs">
        <ul className="grid gap-4 sm:grid-cols-3">
          {JOBS.map((j) => (
            <li key={j.name} className="flex flex-col items-center gap-3 bg-panel p-4 text-center">
              <div className="w-28">
                <div className="sprite-idle">
                  <FighterSprite spriteKey={j.sprite} role={j.role} />
                </div>
              </div>
              <span className={`${j.color} px-3 py-0.5 text-lg uppercase text-ink`}>{j.name}</span>
              <p className="text-lg text-paper">{j.text}</p>
            </li>
          ))}
        </ul>
      </PixelPanel>

      <PixelPanel title="Step by step">
        <ol className="flex flex-col gap-3 text-xl text-paper">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-gold text-lg text-ink">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </PixelPanel>

      <PixelPanel title="Fighter ranks">
        <p className="text-xl text-paper">
          Every fighter has a grade from E up to S. A higher grade means stronger stats. Fighters are also common, uncommon,
          rare or legendary. Legendary fighters are very hard to find!
        </p>
      </PixelPanel>
    </PageShell>
  );
}
