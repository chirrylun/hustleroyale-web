"use client";

import { useState } from "react";
import { BagMenu } from "@/components/floor/BagMenu";
import { FightersButton, FightersMenu } from "@/components/floor/FightersMenu";

/** The bag and fighters buttons on the left edge (fighters below the bag, beside it on small screens). Below the guild's panels, so they never sit over them. */
export function BagButton() {
  const [open, setOpen] = useState<"bag" | "fighters" | null>(null);
  return (
    <>
      {/* pixel-box sets position: relative, so the fixed placement lives on a wrapper */}
      <div className="fixed left-2 top-1/2 z-[100] flex -translate-y-1/2 flex-col gap-2 max-sm:flex-row short:flex-row short:gap-1">
        <button
          type="button" aria-label="Bag" onClick={() => setOpen("bag")}
          onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
          className="pixel-box flex h-12 w-12 short:h-10 short:w-10 items-center justify-center bg-night/90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/bag.png" alt="" className="h-8 w-8" draggable={false} />
        </button>
        <FightersButton onClick={() => setOpen("fighters")} />
      </div>
      {open === "bag" && <BagMenu onClose={() => setOpen(null)} />}
      {open === "fighters" && <FightersMenu onClose={() => setOpen(null)} />}
    </>
  );
}
