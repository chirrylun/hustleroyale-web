"use client";

import { useState } from "react";
import { BagMenu } from "@/components/floor/BagMenu";

/** Just the bag icon, bottom-left of its (relative) parent; opens the bag over that parent. */
export function BagButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button" aria-label="Bag" onClick={() => setOpen(true)}
        onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}
        className="pixel-box fixed left-2 top-1/2 z-[9600] flex h-12 w-12 -translate-y-1/2 short:h-10 short:w-10 items-center justify-center bg-night/90"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ui/bag.png" alt="" className="h-8 w-8" draggable={false} />
      </button>
      {open && <BagMenu onClose={() => setOpen(false)} />}
    </>
  );
}
