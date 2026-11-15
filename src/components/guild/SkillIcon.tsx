import clsx from "clsx";
import { iconOf } from "@/lib/skill-art";

/** A skill's icon, drawn square and crisp. `name` picks the art; `kind` is the fallback for skills with none yet. */
export function SkillIcon({ name, kind, file, size = 44, dim = false, className }: { name: string; kind?: string | null; /** Use this exact icon file instead of looking one up by name (e.g. the empty slot). */ file?: string; size?: number; dim?: boolean; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static pixel art, nothing for next/image to optimise
    <img
      src={`/skills/${file ?? iconOf(name, kind)}.png`} alt="" aria-hidden="true" width={size} height={size} draggable={false}
      className={clsx("shrink-0 select-none object-contain", dim && "opacity-45 grayscale", className)}
      style={{ width: size, height: size, imageRendering: "auto" }}
    />
  );
}
