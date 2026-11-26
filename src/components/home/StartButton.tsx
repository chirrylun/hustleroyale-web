"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Press start: players with a session go straight in; everyone else gets a guest account (no sign-up form). */
export function StartButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function start() {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const sb = createClient();
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        const { error: e } = await sb.auth.signInAnonymously();
        if (e) throw e;
      }
      router.push("/home");
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={start} disabled={busy} className="pixel-btn block w-full cursor-pointer bg-leaf px-4 py-3 text-xl uppercase text-ink">
        {busy ? "Starting…" : "Press start"}
      </button>
      {error && <p role="alert" className="mt-3 text-lg text-ember">Couldn&apos;t start just now. Please try again.</p>}
    </>
  );
}
