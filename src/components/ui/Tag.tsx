import type { ReactNode } from "react";

const TONE = { ok: "bg-leaf text-ink", bad: "bg-ember text-ink", gold: "bg-gold text-ink", sky: "bg-sky text-ink", dim: "bg-night text-steel" } as const;

/** A small pill for a level or a state (class changers use them in place of sentences). ok = met, bad = not met yet. */
export function Tag({ tone, children }: { tone: keyof typeof TONE; children: ReactNode }) {
  return <span className={`whitespace-nowrap px-1.5 text-sm uppercase leading-5 ${TONE[tone]}`}>{children}</span>;
}
