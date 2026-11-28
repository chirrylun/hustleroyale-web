"use client";

/** The label over a recruiting player's head. Tap it to join their party (or to be asked for the password / told the level needed). */
export function JoinBadge({ onJoin, className = "" }: { onJoin: () => void; className?: string }) {
  return (
    <button
      type="button" aria-label="Join this player's party"
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onJoin(); }}
      className={`pointer-events-auto pixel-box animate-bounce whitespace-nowrap bg-gold px-2 py-0.5 text-base uppercase leading-5 text-ink ${className}`}
    >
      Join party
    </button>
  );
}
