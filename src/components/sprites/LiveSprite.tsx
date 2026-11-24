"use client";
import type React from "react";
import { FighterSprite } from "@/components/sprites/FighterSprite";
import { useLook } from "@/lib/lookStore";

/** A fighter's sprite that redraws as soon as gear is equipped or taken off (see lookStore). */
export function LiveSprite({ id, spriteKey, ...rest }: { id: string } & React.ComponentProps<typeof FighterSprite>) {
  return <FighterSprite {...rest} spriteKey={useLook(id, spriteKey)} />;
}
