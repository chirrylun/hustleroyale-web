import { createClient } from "@/lib/supabase/client";

export type Rarity = "common" | "uncommon" | "rare" | "legendary";
export type Role = "tank" | "healer" | "dps";

export interface StarterFighter {
  id: string;
  grade: "E" | "D" | "C" | "B" | "A" | "S";
  level: number;
  team_slot: number;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  stamina: number;
  magic: number;
  template: { name: string; role: Role; archetype: string; rarity: Rarity; sprite_key: string };
  skills: { slot: number; name: string }[];
}

export class StarterPackError extends Error {
  constructor(
    public code: "unauthorized" | "already_opened" | "network" | "server",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Asks the game server to open the starter pack. The server rolls the fighters (the browser
 * never picks its own), so there is nothing here a player can tamper with.
 */
export async function openStarterPack(): Promise<StarterFighter[]> {
  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StarterPackError("unauthorized", "You are signed out. Log in again.");

  let res: Response;
  try {
    res = await fetch(`${process.env.NEXT_PUBLIC_GAME_SERVER_URL}/starter-pack/open`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new StarterPackError("network", "Can't reach the game server. Check your connection and try again.");
  }

  if (res.status === 409) throw new StarterPackError("already_opened", "This pack was already opened.");
  if (res.status === 401) throw new StarterPackError("unauthorized", "You are signed out. Log in again.");
  if (!res.ok) throw new StarterPackError("server", "The pack jammed. Try again in a moment.");

  const body = (await res.json()) as { fighters: StarterFighter[] };
  return body.fighters;
}
