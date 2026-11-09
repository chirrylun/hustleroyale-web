"use client";

import clsx from "clsx";
import { useEffect, useReducer, useState } from "react";
import { Arena } from "@/components/battle/Arena";
import { battleReducer, FINALE_MS } from "@/lib/battle";
import { DemoSim } from "./demoSim";

const TICK_MS = 100;
/** How long the result stays up before the next demo match begins. */
const HOLD_MS = 2800;

const noop = () => {};

/**
 * The homepage demo plays the real arena: live movement around obstacles, danger circles, stuns and
 * the closing ring. It runs a small stand-in for the server (see demoSim.ts), so it is silent and
 * players can't touch it.
 */
export function MatchDemo() {
  const [view, dispatch] = useReducer(battleReducer, null);
  const [phase, setPhase] = useState<"fighting" | "ended">("fighting");

  useEffect(() => {
    let n = 0;
    let sim = new DemoSim(Math.random, n);
    let timers: ReturnType<typeof setTimeout>[] = [];
    dispatch({ type: "start", payload: sim.startPayload(), now: Date.now() });

    const restart = () => {
      sim = new DemoSim(Math.random, ++n);
      dispatch({ type: "start", payload: sim.startPayload(), now: Date.now() });
      setPhase("fighting");
    };

    const tick = setInterval(() => {
      if (document.hidden) return; // do not burn battery in a background tab
      if (sim.finished) return;
      const events = sim.step(TICK_MS);
      if (events.length) dispatch({ type: "events", matchId: sim.matchId, events, now: Date.now() });
      if (sim.finished) {
        dispatch({ type: "end", payload: sim.endPayload() });
        timers = [setTimeout(() => setPhase("ended"), FINALE_MS), setTimeout(restart, FINALE_MS + HOLD_MS)];
      }
    }, TICK_MS);

    const prune = setInterval(() => dispatch({ type: "prune", now: Date.now() }), 150);
    return () => {
      clearInterval(tick);
      clearInterval(prune);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <div
        className="pointer-events-none"
        role="img"
        aria-label="A short animated demo of a match. Two teams of three fighters walk around a street, dodge big attacks, and fight until one team wins."
      >
        {view ? <Arena view={view} phase={phase} canFocus={false} canMove={false} onFocus={noop} onMove={noop} /> : <div className="pixel-box aspect-[3/2] w-full bg-ink" />}
      </div>

      <ul className="grid gap-2 text-base sm:grid-cols-2 sm:text-lg lg:grid-cols-4">
        <RoleHint color="bg-sky" label="Tank" text="Leads the charge" />
        <RoleHint color="bg-leaf" label="Healer" text="Heals from the back" />
        <RoleHint color="bg-ember" label="Damage" text="Hunts weak spots" />
        <RoleHint color="bg-gold" label="Red circle" text="Step out to dodge" />
      </ul>
    </div>
  );
}

function RoleHint({ color, label, text }: { color: string; label: string; text: string }) {
  return (
    <li className="flex items-center gap-2 bg-night/70 px-2 py-1.5">
      <span className={clsx("px-2 py-0.5 text-sm uppercase text-ink", color)}>{label}</span>
      <span className="text-steel">{text}</span>
    </li>
  );
}
