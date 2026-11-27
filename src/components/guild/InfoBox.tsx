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
    <section className="pixel-box card-reveal w-full max-w-xl bg-night p-4 text-left sm:p-5 short:max-h-[92dvh] short:max-w-3xl short:overflow-y-auto short:p-2.5" aria-live="polite">
      {/* Phones (portrait): the speaker and title share a header row and the words get the full width below.
          Wider or landscape: the speaker stands beside the words. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-end gap-x-3 gap-y-2 sm:items-start short:items-start short:gap-y-1">
        {portrait && <div className="row-span-1 flex items-end justify-center max-sm:[zoom:.6] sm:row-span-2 sm:self-stretch short:row-span-2 short:[zoom:1] short:self-stretch">{portrait}</div>}
        <h2 className={`min-w-0 text-2xl uppercase text-gold short:text-xl ${portrait ? "" : "col-span-2"} sm:mb-1`}>{title}</h2>
        <div className={`flex min-h-20 min-w-0 flex-col gap-2 text-xl text-paper short:min-h-0 short:gap-1 short:text-base ${portrait ? "col-span-2 sm:col-span-1 sm:col-start-2 short:col-span-1 short:col-start-2" : "col-span-2"}`}>{children}</div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 sm:mt-5 short:mt-2">
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
