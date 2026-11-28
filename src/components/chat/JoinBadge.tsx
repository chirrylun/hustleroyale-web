"use client";

/** The icon over a recruiting player's head. Tap it to join their party (or to be asked for the password / told the level needed). */
export function JoinBadge({ onJoin, className = "" }: { onJoin: () => void; className?: string }) {
  return (
    <button
      type="button" aria-label="Join this player's party" title="Join party"
      onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onJoin(); }}
      className={`pointer-events-auto pixel-box flex h-7 w-7 animate-bounce items-center justify-center bg-gold text-ink ${className}`}
    >
      <svg viewBox="0 0 12 12" width="16" height="16" shapeRendering="crispEdges" aria-hidden="true">
        <path d="M2 2h3v3H2zM1 6h5v4H1zM8 1h1v6H8zM6 3h5v1H6z" fill="currentColor" transform="translate(0 1)" />
      </svg>
    </button>
  );
}
