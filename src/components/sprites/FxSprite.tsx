import type { CSSProperties } from "react";
import { FX_COLS, FX_ROWS, type FxSheet } from "@/lib/sprites/designs";

/** One skill-effect animation (a row of an effect sheet), played once or looped. */
export function FxSprite({ sheet, row, ms, loop = false, delay = 0, className, style }: { sheet: FxSheet; row: number; ms: number; loop?: boolean; /** Wait this long before the first frame; nothing shows until then. */ delay?: number; className?: string; style?: CSSProperties }) {
  const cols = FX_COLS;
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        aspectRatio: "1",
        backgroundImage: `url(/sprites/fx_${sheet}.png)`,
        backgroundSize: `${cols * 100}% ${FX_ROWS * 100}%`,
        backgroundPosition: `0% ${(row / (FX_ROWS - 1)) * 100}%`,
        backgroundRepeat: "no-repeat",
        animation: `spr ${ms}ms steps(${cols}, jump-none) ${delay}ms ${loop ? "infinite" : "1 both"}${delay ? ", fx-appear 1ms step-end " + delay + "ms both" : ""}`,
        ["--to" as string]: "100%",
        ...style,
      }}
    />
  );
}
