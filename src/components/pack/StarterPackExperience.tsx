"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { StarterPackError, openStarterPack, type StarterFighter } from "@/lib/starter-pack";
import { FighterCard } from "./FighterCard";

const HOLD_MS = 1800; // how long the pack must be held
const DRAIN_MS = 600; // how fast the slider falls back when released early
const MIN_OPEN_MS = 900; // keep the burst on screen even if the server answers instantly

type Stage = "ready" | "opening" | "reveal";

export function StarterPackExperience({ username }: { username: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("ready");
  const [percent, setPercent] = useState(0);
  const [fighters, setFighters] = useState<StarterFighter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [leaving, startLeaving] = useTransition();

  const packRef = useRef<HTMLButtonElement>(null);
  const holding = useRef(false);
  const progress = useRef(0);

  const open = useCallback(async () => {
    setStage("opening");
    setError(null);
    try {
      const [result] = await Promise.all([
        openStarterPack(),
        new Promise((resolve) => setTimeout(resolve, MIN_OPEN_MS)),
      ]);
      setFighters(result);
      setStage("reveal");
    } catch (err) {
      if (err instanceof StarterPackError && err.code === "already_opened") {
        router.refresh();
        return;
      }
      progress.current = 0;
      setPercent(0);
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setStage("ready");
    }
  }, [router]);

  // Hold-to-open loop: fills while held, drains when released, shakes harder as it fills.
  useEffect(() => {
    if (stage !== "ready") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = now - last;
      last = now;

      const delta = holding.current ? dt / HOLD_MS : -dt / DRAIN_MS;
      progress.current = Math.min(1, Math.max(0, progress.current + delta));
      const p = progress.current;
      setPercent((prev) => (Math.round(p * 100) === prev ? prev : Math.round(p * 100)));

      const el = packRef.current;
      if (el) {
        if (reduceMotion || p === 0) {
          el.style.transform = "";
        } else {
          // Balatro-style: wobble amplitude and speed ramp up with progress.
          const e = p * p;
          const x = Math.sin(now * (0.03 + p * 0.05)) * e * 16;
          const y = Math.cos(now * (0.04 + p * 0.05)) * e * 8;
          const rot = Math.sin(now * (0.025 + p * 0.06) + 1) * e * 12;
          const scale = 1 + p * 0.14;
          el.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg) scale(${scale})`;
        }
      }

      if (p >= 1) {
        holding.current = false;
        void open();
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, open]);

  const startHold = () => {
    holding.current = true;
  };
  const stopHold = () => {
    holding.current = false;
  };

  if (stage === "reveal") {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center gap-6 p-6">
        <h1 className="text-center text-4xl uppercase text-gold">Your crew</h1>
        <p className="text-center text-xl text-steel">Three fighters, ready for the arena.</p>

        <div className="grid w-full gap-6 sm:grid-cols-3">
          {fighters.map((f, i) => (
            <FighterCard key={f.id} fighter={f} delayMs={i * 450} />
          ))}
        </div>

        <div className="card-reveal" style={{ animationDelay: `${fighters.length * 450 + 200}ms` }}>
          <PixelButton className="text-2xl" disabled={leaving} onClick={() => startLeaving(() => router.refresh())}>
            {leaving ? "Loading..." : "Go to homepage"}
          </PixelButton>
        </div>
      </main>
    );
  }

  const opening = stage === "opening";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <section className="pixel-box w-full bg-night p-5" aria-live="polite">
        <p className="text-lg uppercase text-steel">Welcome to Hustle Royale</p>
        <h1 className="mt-1 text-4xl uppercase text-gold sm:text-5xl">Hey, {username}!</h1>
        <p className="mt-3 text-xl text-paper">
          Your starter pack is here. <span className="text-lime">Press and hold</span> the pack to open it.
        </p>
      </section>

      <div className="relative flex h-80 w-full items-center justify-center">
        {opening && <div className="pack-flash pointer-events-none absolute inset-0 z-10 bg-paper" aria-hidden="true" />}

        <div className={opening ? "" : "pack-bob"}>
          <button
            ref={packRef}
            type="button"
            disabled={opening}
            aria-label="Starter pack. Press and hold to open."
            className="pack pixel-box pixelated relative flex h-64 w-48 touch-none select-none flex-col items-center justify-between bg-ember p-3 text-ink outline-offset-8 focus-visible:outline-4 focus-visible:outline-lime"
            style={opening ? { animation: "pack-burst 900ms steps(9) forwards" } : undefined}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              startHold();
            }}
            onPointerUp={stopHold}
            onPointerCancel={stopHold}
            onLostPointerCapture={stopHold}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                startHold();
              }
            }}
            onKeyUp={(e) => {
              if (e.key === " " || e.key === "Enter") stopHold();
            }}
            onBlur={stopHold}
          >
            <span className="text-lg uppercase">Starter</span>
            <span className="flex h-24 w-24 items-center justify-center border-4 border-ink bg-gold text-6xl" aria-hidden="true">
              ?
            </span>
            <span className="text-lg uppercase">Pack</span>
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm">
        <div
          role="progressbar"
          aria-label="Opening progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="pixel-box h-8 w-full bg-ink"
        >
          <div className="h-full bg-lime" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-3 text-lg uppercase text-steel">{opening ? "Opening..." : percent > 0 ? "Keep holding..." : "Hold to open"}</p>
        {error && (
          <p role="alert" className="mt-3 text-lg text-ember">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
