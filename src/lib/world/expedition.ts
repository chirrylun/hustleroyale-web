/**
 * The party's health and who is still standing carry from floor to floor. It lasts for one expedition:
 * heading out from the guild (or losing) starts fresh, and resting in the guild heals everyone.
 * Kept per browser tab; fighters are stored as fractions so a level-up in between still counts.
 */
const KEY = "pocket-expedition";
interface Saved { sig: string; st: Record<string, [number, number]>; at?: number }

export const partySig = (ids: string[]) => [...ids].sort().join(",");

export function readExpedition(sig: string): Record<string, [number, number]> | null {
  try {
    const j = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
    return j && j.sig === sig ? j.st : null;
  } catch { return null; }
}

export function writeExpedition(sig: string, units: { id: string; hp: number; max: number; en: number; maxEn: number; dead: boolean }[]) {
  try {
    const st: Saved["st"] = {};
    for (const u of units) st[u.id] = [u.dead ? 0 : Math.max(0.01, u.hp / u.max), u.maxEn > 0 ? u.en / u.maxEn : 1];
    sessionStorage.setItem(KEY, JSON.stringify({ sig, st, at: Date.now() } satisfies Saved));
  } catch { /* storage can be unavailable; the party simply starts fresh */ }
}

/** The party's last known health fractions and when they were written, whatever the party was (used by the guild to show who comes home hurt). */
export function readLastHealth(): { at: number; fracs: Record<string, number> } | null {
  try {
    const j = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Saved | null;
    if (!j?.at) return null;
    return { at: j.at, fracs: Object.fromEntries(Object.entries(j.st).map(([id, v]) => [id, v[0]])) };
  } catch { return null; }
}

export function clearExpedition() {
  try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
