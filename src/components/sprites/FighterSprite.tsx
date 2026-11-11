"use client";

import clsx from "clsx";
import { useState } from "react";
import { ANIMS, COLS, sheetUrl, type Role } from "@/lib/sprites/designs";

export type Action = "attack" | "cast" | "hurt";
export type Rest = "idle" | "walk" | "windup" | "stun";
const BASE_MS: Record<string, number> = { idle: 900, walk: 620, attack: 360, cast: 460, hurt: 280, windup: 260 };

/**
 * Animated fighter. Each class/rarity has one sprite sheet (rows = animations) played with a stepped
 * CSS background animation, so motion costs no JS per frame. `action` plays once then falls back to
 * the looping `rest` pose; change `actionKey` to replay it.
 */
export function FighterSprite({
  spriteKey, role, flip = false, className, rest = "idle", action = null, actionKey = 0, tempo = 1, still = false,
}: {
  spriteKey: string; role: Role; flip?: boolean; className?: string; rest?: Rest; action?: Action | null; actionKey?: number; tempo?: number; still?: boolean;
}) {
  const [done, setDone] = useState(-1);
  const once = action && done !== actionKey ? action : null;
  const name = once ?? (rest === "stun" ? "hurt" : rest);
  const row = ANIMS.findIndex((a) => a.name === name);
  const n = ANIMS[row].n;
  const ms = BASE_MS[name] * (name === "walk" ? 1 / tempo : 1) * (rest === "stun" && !once ? 2 : 1);

  return (
    <div
      key={`${name}-${once ? actionKey : "r"}`}
      className={clsx("aspect-square w-full", className)}
      aria-hidden="true"
      onAnimationEnd={() => once && setDone(actionKey)}
      style={{
        backgroundImage: `url(${sheetUrl(spriteKey, role)})`,
        backgroundSize: `${COLS * 100}% ${ANIMS.length * 100}%`,
        backgroundPosition: `0% ${(row / (ANIMS.length - 1)) * 100}%`,
        backgroundRepeat: "no-repeat",
        transform: flip ? "scaleX(-1)" : undefined,
        animation: still ? undefined : `spr ${ms}ms steps(${n}, jump-none) ${once ? "1 forwards" : "infinite"}`,
        ["--to" as string]: `${((n - 1) / (COLS - 1)) * 100}%`,
      }}
    />
  );
}
