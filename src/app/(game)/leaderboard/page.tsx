import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import clsx from "clsx";
import { PageShell } from "@/components/layout/PageShell";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { createClient } from "@/lib/supabase/server";

export default function LeaderboardPage() {
  return (
    <PageShell title="Leaderboard">
      <Suspense fallback={<div className="h-96 animate-pulse bg-panel" aria-busy="true" />}>
        <Board />
      </Suspense>
    </PageShell>
  );
}

interface Row {
  rank: number;
  id: string;
  username: string;
  level: number;
  rating: number;
  wins: number;
  losses: number;
}

const TIERS = [
  { name: "Champion", ring: "border-gold", chip: "bg-gold text-ink", glow: "shadow-[0_0_24px_var(--gold)]" },
  { name: "Duelist", ring: "border-steel", chip: "bg-steel text-ink", glow: "" },
  { name: "Brawler", ring: "border-ember", chip: "bg-ember text-ink", glow: "" },
];

async function Board() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Ranking is computed in the database (security-definer function), so players can see each other's
  // score without being able to read anyone else's full profile row.
  const [{ data: top }, { data: mine }, { data: me }] = await Promise.all([
    supabase.rpc("get_leaderboard", { p_limit: 50 }),
    supabase.rpc("get_my_rank"),
    supabase.from("profiles").select("username, level").eq("id", user.id).single(),
  ]);
  const rows = (top ?? []) as Row[];
  const myRank = (mine as { rank: number; rating: number; wins: number; losses: number }[] | null)?.[0];
  const inTop = rows.some((r) => r.id === user.id);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);

  if (rows.length === 0) {
    return (
      <PixelPanel title="Hall of champions">
        <p className="text-xl text-paper">No one has earned a score yet. Win a match to claim the first place!</p>
      </PixelPanel>
    );
  }

  return (
    <>
      {myRank && (
        <PixelPanel className="flex flex-wrap items-center justify-between gap-4 border-gold">
          <div>
            <p className="text-lg uppercase text-steel">Your standing</p>
            <p className="text-3xl uppercase text-gold">{me?.username ?? "You"}</p>
          </div>
          <Stat label="Rank" value={`#${myRank.rank}`} accent />
          <Stat label="Score" value={myRank.rating} />
          <Stat label="Wins / Losses" value={`${myRank.wins} / ${myRank.losses}`} />
        </PixelPanel>
      )}

      {/* Podium: second, first, third, with the champion raised in the middle. */}
      <div className="grid grid-cols-3 items-end gap-3 sm:gap-5" aria-label="Top three players">
        {[podium[1], podium[0], podium[2]].map((p, i) => {
          if (!p) return <div key={i} />;
          const tier = TIERS[p.rank - 1];
          const first = p.rank === 1;
          return (
            <div
              key={p.id}
              className={clsx(
                "pixel-box flex flex-col items-center gap-2 border-4 bg-night p-3 text-center sm:p-4",
                tier.ring,
                tier.glow,
                first ? "pb-8 pt-6 sm:pb-12" : "pb-4",
                p.id === user.id && "bg-panel",
              )}
            >
              <span className={clsx("px-2 py-0.5 text-sm uppercase sm:text-lg", tier.chip)}>{tier.name}</span>
              <span className={clsx("text-5xl leading-none sm:text-7xl", first ? "text-gold" : "text-paper")}>{p.rank}</span>
              <span className="w-full truncate text-lg uppercase text-paper sm:text-2xl" title={p.username}>
                {p.username}
              </span>
              <span className="text-2xl text-gold sm:text-3xl">{p.rating}</span>
              <span className="text-sm text-steel sm:text-lg">
                LV {p.level} · {p.wins}W {p.losses}L
              </span>
            </div>
          );
        })}
      </div>

      <PixelPanel title="Hall of champions">
        <div className="grid grid-cols-[3.5rem_1fr_3.5rem_5rem] items-center gap-2 border-b-4 border-panel pb-2 text-base uppercase text-steel sm:grid-cols-[4rem_1fr_4rem_7rem_6rem] sm:text-lg">
          <span>Rank</span>
          <span>Player</span>
          <span>Lvl</span>
          <span className="hidden sm:block">Wins / Losses</span>
          <span className="text-right">Score</span>
        </div>
        <ol className="flex flex-col">
          {rest.map((r) => (
            <Line key={r.id} r={r} you={r.id === user.id} />
          ))}
          {!inTop && myRank && (
            <>
              <li className="py-1 text-center text-xl text-mist" aria-hidden="true">
                · · ·
              </li>
              <Line r={{ rank: myRank.rank, id: user.id, username: me?.username ?? "You", level: me?.level ?? 1, rating: myRank.rating, wins: myRank.wins, losses: myRank.losses }} you />
            </>
          )}
        </ol>
      </PixelPanel>
    </>
  );
}

function Line({ r, you }: { r: Row; you?: boolean }) {
  return (
    <li
      className={clsx(
        "grid grid-cols-[3.5rem_1fr_3.5rem_5rem] items-center gap-2 border-b-2 border-panel py-2 text-lg sm:grid-cols-[4rem_1fr_4rem_7rem_6rem] sm:text-xl",
        you && "-mx-2 border-2 border-gold bg-panel px-2",
      )}
    >
      <span className="text-steel">#{r.rank}</span>
      <span className={clsx("truncate uppercase", you ? "text-gold" : "text-paper")} title={r.username}>
        {r.username}
        {you && <span className="ml-2 text-base text-lime">(you)</span>}
      </span>
      <span className="text-steel">{r.level}</span>
      <span className="hidden text-steel sm:block">
        <span className="text-leaf">{r.wins}W</span> / <span className="text-blood">{r.losses}L</span>
      </span>
      <span className="text-right text-gold">{r.rating}</span>
    </li>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-base uppercase text-steel">{label}</p>
      <p className={clsx("text-3xl", accent ? "text-gold" : "text-paper")}>{value}</p>
    </div>
  );
}
