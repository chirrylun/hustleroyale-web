import clsx from "clsx";
import type { HTMLAttributes, ReactNode } from "react";

export function PixelPanel({
  title,
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { title?: string; children: ReactNode }) {
  return (
    <section {...props} className={clsx("pixel-box bg-night p-4", className)}>
      {title && <h2 className="mb-3 text-xl uppercase text-gold">{title}</h2>}
      {children}
    </section>
  );
}
