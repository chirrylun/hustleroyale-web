"use client";

import { useEffect } from "react";
import { playTap, warmSounds } from "@/lib/sfx";

/**
 * Plays the tap sound whenever a button is pressed, anywhere in the game: every `.pixel-btn` (the Press start link, menu
 * buttons, the tutorial's Back and Next, dialogue buttons) plus plain buttons such as the guild hall's tappable props.
 * One listener on the page, so new buttons get the sound without any code of their own.
 * Opt out with data-silent on a button or any element around it (for buttons that make their own sound).
 */
export function TapSound() {
  useEffect(() => {
    warmSounds(["/audio/ui/tap.mp3"]);
    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest?.("button, [role='button'], .pixel-btn");
      if (!el || el.closest("[data-silent]")) return;
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      playTap();
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
