"use client";

import clsx from "clsx";
import { useEffect, useState } from "react";
import { ANIMS, COLS } from "@/lib/sprites/draw";
import { sheetUrl } from "@/lib/sprites/sheet";
import type { Role } from "@/lib/sprites/designs";

export type Action = "attack" | "cast" | "hurt";
export type Rest = "idle" | "walk" | "windup" | "stun";
const ROW_COUNT = ANIMS.length;
const BASE_MS: Record<string, number> = { idle: 900, walk: 620, attack: 340, cast: 440, hurt: 260, windup: 240 };

/**
 * Animated pixel fighter. The sheet is generated once per fighter (lazy, cached) and played with a
 * stepped CSS background animation, so motion costs no JS per frame. `action` plays once then falls
 * back to the looping `rest` pose; change `actionKey` to replay it.
 */
export function FighterSprite({
  spriteKey, role, flip = false, className, rest = "idle", action = null, actionKey = 0, tempo = 1,
}: {
  spriteKey: string; role: Role; flip?: boolean; className?: string; rest?: Rest; action?: Action | null; actionKey?: number; tempo?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [done, setDone] = useState(-1);
  useEffect(() => setUrl(sheetUrl(spriteKey, role)), [spriteKey, role]);

  const once = action && done !== actionKey ? action : null;
  const name = once ?? (rest === "stun" ? "hurt" : rest);
  const row = ANIMS.findIndex((a) => a.name === name);
  const n = ANIMS[row].n;
  const ms = (BASE_MS[name] * (name === "walk" ? 1 / tempo : 1)) * (rest === "stun" && !once ? 2 : 1);

  return (
    <div
      key={`${name}-${once ? actionKey : "r"}`}
      className={clsx("aspect-square w-full", className)}
      aria-hidden="true"
      onAnimationEnd={() => once && setDone(actionKey)}
      style={{
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: `${COLS * 100}% ${ROW_COUNT * 100}%`,
        backgroundPosition: `0% ${(row / (ROW_COUNT - 1)) * 100}%`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
        transform: flip ? "scaleX(-1)" : undefined,
        animation: url ? `spr ${ms}ms steps(${n}, jump-none) ${once ? "1 forwards" : "infinite"}` : undefined,
        ["--to" as string]: `${((n - 1) / (COLS - 1)) * 100}%`,
      }}
    />
  );
}
