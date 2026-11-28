"use client";

import { useRouter } from "next/navigation";

/** Goes back to wherever the player opened this page from (the guild, a town or a floor); the guild if there is nothing to go back to. */
export function BackButton({ className = "" }: { className?: string }) {
  const router = useRouter();
  return (
    <button type="button" onClick={() => (window.history.length > 1 ? router.back() : router.push("/home"))} className={`pixel-btn bg-panel px-4 py-2 text-lg uppercase text-paper ${className}`}>
      Back
    </button>
  );
}
