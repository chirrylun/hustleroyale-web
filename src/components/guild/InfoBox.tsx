"use client";

import type { ReactNode } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";

/** The tutorial's speech box: title, body, progress dots and Back / Next buttons. */
export function InfoBox({
  title, children, step, total, onBack, onNext, nextLabel = "Next", busy,
}: {
  title: string; children: ReactNode; step: number; total: number;
  onBack?: () => void; onNext: () => void; nextLabel?: string; busy?: boolean;
}) {
  return (
    <section className="pixel-box card-reveal w-full max-w-xl bg-night p-5 text-left" aria-live="polite">
      <h2 className="mb-3 text-2xl uppercase text-gold">{title}</h2>
      <div className="flex min-h-24 flex-col gap-2 text-xl text-paper">{children}</div>
      <div className="mt-5 flex items-center justify-between gap-3">
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
