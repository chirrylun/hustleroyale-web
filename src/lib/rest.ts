/** Fighters heal by themselves while they are away from a fight: this share of their health every second. */
export const REST_PCT_PER_SEC = 0.1;

/**
 * Healing starts this many seconds after the last save. The last save is made on the floor, and getting back to the
 * guild (leaving, loading the page) takes a few seconds, so without a pause a fighter at 40% would already be full
 * by the time you see them and there would be nothing to watch heal.
 */
export const REST_DELAY_SEC = 6;

/** A fighter's health (0 to 1) now, given what was saved and when. Fallen fighters recover too. */
export const restedFrac = (frac: number | null | undefined, savedAt: string | number | null | undefined, now = Date.now()): number => {
  const f = frac ?? 1;
  const t = savedAt ? new Date(savedAt).getTime() : now;
  return Math.max(0, Math.min(1, f + REST_PCT_PER_SEC * Math.max(0, (now - t) / 1000 - REST_DELAY_SEC)));
};
