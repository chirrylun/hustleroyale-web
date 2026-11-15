import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The job board and the player's pack. Quests are what open new floors: each floor has a kill quest and an
 * item-fetch quest, and handing in both opens the next floor (enforced in the database by claim_quest).
 */
export interface BoardQuest {
  slug: string;
  title: string;
  blurb: string;
  kind: "kill" | "fetch";
  floor: number;
  unlocksFloor: number;
  qty: number;
  rewardCoins: number;
  rewardXp: number;
  itemName: string | null;
  status: "available" | "active";
  progress: number;
}
export interface PackItem { slug: string; name: string; qty: number }

export interface ActiveQuest { slug: string; title: string; kind: "kill" | "fetch"; qty: number; progress: number; itemSlug: string | null }

interface QuestRow {
  slug: string; title: string; blurb: string; kind: "kill" | "fetch"; floor: number; unlocks_floor: number; qty: number;
  reward_coins: number; reward_xp: number; item_slug: string | null; item: { name: string } | null;
}

/** Items the player holds, by slug. */
export async function loadPack(supabase: SupabaseClient, userId: string): Promise<PackItem[]> {
  const { data } = await supabase.from("player_items").select("item_slug, qty, item:item_templates(name)").eq("owner_id", userId).gt("qty", 0);
  return ((data ?? []) as unknown as { item_slug: string; qty: number; item: { name: string } | null }[])
    .map((r) => ({ slug: r.item_slug, name: r.item?.name ?? r.item_slug, qty: r.qty }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The quests on offer: the two for the floor the player has reached (each floor's pair opens the one after).
 * Quests for floors already passed are marked done in the database, so they never show up again.
 */
export async function loadBoard(supabase: SupabaseClient, userId: string, floorUnlocked: number): Promise<{ quests: BoardQuest[]; pack: PackItem[] }> {
  const [{ data: qs }, { data: mine }, pack] = await Promise.all([
    supabase.from("quests").select("slug, title, blurb, kind, floor, unlocks_floor, qty, reward_coins, reward_xp, item_slug, item:item_templates(name)").eq("floor", floorUnlocked).order("sort"),
    supabase.from("player_quests").select("quest_slug, progress, status").eq("owner_id", userId),
    loadPack(supabase, userId),
  ]);
  const taken = new Map(((mine ?? []) as { quest_slug: string; progress: number; status: string }[]).map((r) => [r.quest_slug, r]));
  const held = new Map(pack.map((i) => [i.slug, i.qty]));
  const quests = ((qs ?? []) as unknown as QuestRow[])
    .filter((q) => taken.get(q.slug)?.status !== "done")
    .map<BoardQuest>((q) => {
      const t = taken.get(q.slug);
      const progress = !t ? 0 : q.kind === "fetch" ? Math.min(q.qty, held.get(q.item_slug ?? "") ?? 0) : t.progress;
      return {
        slug: q.slug, title: q.title, blurb: q.blurb, kind: q.kind, floor: q.floor, unlocksFloor: q.unlocks_floor, qty: q.qty,
        rewardCoins: q.reward_coins, rewardXp: q.reward_xp, itemName: q.item?.name ?? null, status: t ? "active" : "available", progress,
      };
    });
  return { quests, pack };
}

/** Active quests tied to one floor, for the in-floor tracker. */
export async function loadFloorQuests(supabase: SupabaseClient, userId: string, floor: number): Promise<{ quests: ActiveQuest[]; pack: PackItem[] }> {
  const [{ data }, pack] = await Promise.all([
    supabase.from("player_quests").select("progress, quest:quests(slug, title, kind, floor, qty, item_slug)").eq("owner_id", userId).eq("status", "active"),
    loadPack(supabase, userId),
  ]);
  const rows = (data ?? []) as unknown as { progress: number; quest: { slug: string; title: string; kind: "kill" | "fetch"; floor: number; qty: number; item_slug: string | null } | null }[];
  const quests = rows
    .filter((r) => r.quest && r.quest.floor === floor)
    .map<ActiveQuest>((r) => ({ slug: r.quest!.slug, title: r.quest!.title, kind: r.quest!.kind, qty: r.quest!.qty, progress: r.progress, itemSlug: r.quest!.item_slug }));
  return { quests, pack };
}

export const QUEST_ERRORS: Record<string, string> = {
  quest_not_done: "That quest isn't finished yet.",
  quest_not_active: "You haven't taken that quest.",
  already_taken: "You already took that quest.",
  floor_locked: "You can't reach that floor yet.",
  finish_first_job: "Finish your first job first.",
};
export const questError = (message: string) => Object.entries(QUEST_ERRORS).find(([k]) => message.includes(k))?.[1] ?? "That didn't work. Try again.";
