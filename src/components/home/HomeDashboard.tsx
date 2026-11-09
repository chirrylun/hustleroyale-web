import clsx from "clsx";
import Link from "next/link";
import { MatchDemo } from "./MatchDemo";
import { PixelIcon, type IconName } from "./PixelIcon";

export interface DashboardProfile {
  username: string;
  level: number;
  coins: number;
  rating: number;
  wins: number;
  losses: number;
}

interface MenuItem {
  href: string;
  title: string;
  hint: string;
  icon: IconName;
  color: string;
}

/** Plain words on purpose: a 10 year old should know what every button does. */
const LEFT: MenuItem[] = [
  { href: "/team", title: "My Fighters", hint: "See your team", icon: "fighters", color: "bg-sky" },
  { href: "/training", title: "Training", hint: "Make fighters stronger", icon: "training", color: "bg-leaf" },
  { href: "/market", title: "Marketplace", hint: "Buy and sell fighters", icon: "market", color: "bg-gold" },
];

const RIGHT: MenuItem[] = [
  { href: "/leaderboard", title: "Leaderboard", hint: "See the best players", icon: "leaderboard", color: "bg-ember" },
  { href: "/how-to-play", title: "How to Play", hint: "Learn in one minute", icon: "help", color: "bg-ice" },
  { href: "/profile", title: "My Profile", hint: "Your name and score", icon: "profile", color: "bg-lime" },
];

export function HomeDashboard({ profile }: { profile: DashboardProfile }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg text-steel">Welcome back</p>
          <h1 className="text-3xl uppercase text-gold sm:text-4xl">{profile.username}</h1>
        </div>
        <dl className="flex flex-wrap gap-2 text-lg">
          <Chip label="Level" value={profile.level} />
          <Chip label="Coins" value={profile.coins} />
          <Chip label="Score" value={profile.rating} />
          <Chip label="Wins / Losses" value={`${profile.wins} / ${profile.losses}`} />
        </dl>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_15rem]">
        <nav aria-label="Game menu, left" className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:order-none lg:grid-cols-1">
          {LEFT.map((item) => (
            <MenuButton key={item.href} {...item} />
          ))}
        </nav>

        <section aria-label="How a match works" className="order-first flex flex-col gap-4 lg:order-none">
          <MatchDemo />
          <Link
            href="/arena"
            className="pixel-btn flex items-center justify-center gap-3 bg-leaf px-4 py-4 text-2xl uppercase text-ink sm:text-3xl"
          >
            <PixelIcon name="fight" className="h-8 w-8" />
            Find a Match
          </Link>
        </section>

        <nav aria-label="Game menu, right" className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {RIGHT.map((item) => (
            <MenuButton key={item.href} {...item} />
          ))}
        </nav>
      </div>
    </main>
  );
}

function MenuButton({ href, title, hint, icon, color }: MenuItem) {
  return (
    <Link href={href} className="pixel-btn flex items-center gap-3 bg-panel p-3 text-paper">
      <span className={clsx("flex h-12 w-12 shrink-0 items-center justify-center text-ink", color)}>
        <PixelIcon name={icon} className="h-8 w-8" />
      </span>
      <span className="min-w-0">
        <span className="block text-xl uppercase leading-tight">{title}</span>
        <span className="block text-base leading-tight text-steel">{hint}</span>
      </span>
    </Link>
  );
}

function Chip({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="pixel-box bg-night px-3 py-1">
      <dt className="text-sm text-steel">{label}</dt>
      <dd className="text-xl text-paper">{value}</dd>
    </div>
  );
}
