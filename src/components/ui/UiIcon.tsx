import { UI_CELLS, UI_SHEET, type UiCell } from "@/lib/items";

/** One picture from the shared UI icon sheet, drawn `size` px square. */
export function UiIcon({ name, size = 32, className = "" }: { name: UiCell; size?: number; className?: string }) {
  const [c, r] = UI_CELLS[name];
  const cell = size * 1.16; // trim the margin of each cell, where neighbouring art can bleed in
  const off = (cell - size) / 2;
  return (
    <span
      aria-hidden className={`inline-block shrink-0 [image-rendering:auto] ${className}`}
      style={{ width: size, height: size, backgroundImage: `url(${UI_SHEET.src})`, backgroundSize: `${cell * UI_SHEET.cols}px ${cell * UI_SHEET.rows}px`, backgroundPosition: `${-c * cell - off}px ${-r * cell - off}px` }}
    />
  );
}
