import Link from "next/link";
import { BackButton } from "@/components/layout/BackButton";
import type { ReactNode } from "react";
import { Music } from "@/components/Music";

/** Shared frame for the inner pages (the guild song keeps playing through them): a big way back home and a clear title. */
export function PageShell({ title, children, music = true, back = false }: { title: string; children: ReactNode; music?: boolean; /** Go back to where the page was opened from instead of home. */ back?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6">
      {music && <Music track="guild" />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl uppercase text-gold sm:text-4xl">{title}</h1>
        {back ? <BackButton /> : (
          <Link href="/home" className="pixel-btn bg-panel px-4 py-2 text-lg uppercase text-paper">
            Back to home
          </Link>
        )}
      </div>
      {children}
    </main>
  );
}
