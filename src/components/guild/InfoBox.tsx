"use client";

import type { ReactNode } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";

/** The tutorial's speech box: title, body, progress dots and Back / Next buttons. */
export function InfoBox({
  title, children, step, total, onBack, onNext, nextLabel = "Next", busy, portrait,
}: {
  /** Who is speaking, shown inside the box at its left. */
  portrait?: ReactNode;
  title: string; children: ReactNode; step: number; total: number;
  onBack?: () => void; onNext: () => void; nextLabel?: string; busy?: boolean;
}) {
  return (
    <section className="pixel-box card-reveal w-full max-w-xl bg-night p-5 text-left short:max-h-[92dvh] short:max-w-3xl short:overflow-y-auto short:p-2.5" aria-live="polite">
      <div className="flex items-start gap-3">
        {portrait && <div className="flex shrink-0 items-end justify-center self-stretch">{portrait}</div>}
        <div className="min-w-0 flex-1">
          <h2 className="mb-3 text-2xl uppercase text-gold short:mb-1 short:text-xl">{title}</h2>
          <div className="flex min-h-24 flex-col gap-2 text-xl text-paper short:min-h-0 short:gap-1 short:text-base">{children}</div>
        </div>
      </div>
      <div className="mt-5 short:mt-2 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-label={`Step ${step + 1} of ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={i === step ? "h-2.5 w-2.5 bg-gold" : i < step ? "h-2.5 w-2.5 bg-leaf" : "h-2.5 w-2.5 bg-panel"} />
          ))}
        </div>
        <div className="flex gap-2">
          {onBack && <PixelButton variant="ghost" className="text-lg" disabled={busy} onClick={onBack}>Back</PixelButton>}
          <PixelButton className="text-lg" disabled={busy} onClick={onNext}>{nextLabel}</PixelButton>
        </div>
      </div>
    </section>
  );
}
