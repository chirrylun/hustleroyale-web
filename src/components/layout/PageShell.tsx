import Link from "next/link";
import type { ReactNode } from "react";

/** Shared frame for the inner pages: a big way back home and a clear title. */
export function PageShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl uppercase text-gold sm:text-4xl">{title}</h1>
        <Link href="/home" className="pixel-btn bg-panel px-4 py-2 text-lg uppercase text-paper">
          Back to home
        </Link>
      </div>
      {children}
    </main>
  );
}
