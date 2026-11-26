import { LiveBackdrop } from "@/components/home/LiveBackdrop";
import { Music } from "@/components/Music";
import Link from "next/link";
import { StartButton } from "@/components/home/StartButton";
import { PixelPanel } from "@/components/pixel/PixelPanel";

export default function Landing() {
  return (
    <>
    <Music track="intro" />
    <LiveBackdrop />
    <main className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <h1 className="text-5xl uppercase tracking-widest text-gold sm:text-7xl">Pocket RPG</h1>
      <p className="max-w-md text-xl text-steel">
        Embark on a 2D adventure, build a crew of adventurers and build your legacy as the best team on the server.
      </p>
      <PixelPanel className="w-full max-w-sm">
        <StartButton />
      </PixelPanel>
      <Link href="/login" className="text-lg text-steel underline">Already have an account? Sign in</Link>
    </main>
    </>
  );
}
