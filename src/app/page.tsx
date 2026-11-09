import Link from "next/link";
import { PixelPanel } from "@/components/pixel/PixelPanel";

export default function Landing() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 className="text-5xl uppercase tracking-widest text-gold sm:text-7xl">Hustle Royale</h1>
      <p className="max-w-md text-xl text-steel">
        Open your starter pack, build a crew of three and fight for the arena crown.
      </p>
      <PixelPanel className="w-full max-w-sm">
        <Link
          href="/login"
          className="pixel-btn block bg-leaf px-4 py-3 text-xl uppercase text-ink"
        >
          Press start
        </Link>
      </PixelPanel>
    </main>
  );
}
