import type { CSSProperties } from "react";
import { FX_COLS, type FxSheet } from "@/lib/sprites/designs";

/** One skill-effect animation (a row of an effect sheet), played once or looped. */
export function FxSprite({ sheet, row, ms, loop = false, className, style }: { sheet: FxSheet; row: number; ms: number; loop?: boolean; className?: string; style?: CSSProperties }) {
  const cols = FX_COLS[sheet];
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        aspectRatio: "1",
        backgroundImage: `url(/sprites/fx_${sheet}.png)`,
        backgroundSize: `${cols * 100}% 600%`,
        backgroundPosition: `0% ${(row / 5) * 100}%`,
        backgroundRepeat: "no-repeat",
        animation: `spr ${ms}ms steps(${cols}, jump-none) ${loop ? "infinite" : "1 forwards"}`,
        ["--to" as string]: "100%",
        ...style,
      }}
    />
  );
}
