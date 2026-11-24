"use client";
import { useSyncExternalStore } from "react";

/** The look a fighter was just given by equipping (or taking off) gear, so every screen on the page redraws at once instead of waiting for a reload. */
const looks = new Map<string, string>();
const subs = new Set<() => void>();

export function setLook(id: string, spriteKey: string) {
  if (looks.get(id) === spriteKey) return;
  looks.set(id, spriteKey);
  subs.forEach((f) => f());
}

/** The sprite to draw for a fighter: the fresh look if there is one, else `fallback`. */
export function useLook(id: string, fallback: string): string {
  return useSyncExternalStore(
    (f) => { subs.add(f); return () => { subs.delete(f); }; },
    () => looks.get(id) ?? fallback,
    () => fallback,
  );
}
