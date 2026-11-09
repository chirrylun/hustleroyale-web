import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "ghost" | "danger";

const styles: Record<Variant, string> = {
  primary: "bg-leaf text-ink",
  ghost: "bg-panel text-paper",
  danger: "bg-blood text-paper",
};

export function PixelButton({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={clsx("pixel-btn px-4 py-2 text-lg uppercase tracking-wide cursor-pointer", styles[variant], className)}
    />
  );
}
