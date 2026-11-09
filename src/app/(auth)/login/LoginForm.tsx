"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { PixelButton } from "@/components/pixel/PixelButton";
import { createClient } from "@/lib/supabase/client";

const field = "w-full border-4 border-paper bg-ink px-3 py-2 text-lg text-paper outline-none focus:border-gold";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMessage(error.message);
      else {
        router.push("/home");
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) setMessage(error.message);
      else if (data.session) {
        router.push("/home");
        router.refresh();
      } else setMessage("Check your email to confirm your account, then sign in.");
    }
    setBusy(false);
  }

  async function google() {
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {mode === "signup" && (
        <input
          className={field}
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          minLength={3}
          maxLength={24}
          required
          autoComplete="username"
        />
      )}
      <input
        className={field}
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
      />
      <input
        className={field}
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={8}
        required
        autoComplete={mode === "signin" ? "current-password" : "new-password"}
      />
      {message && <p className="text-ember">{message}</p>}
      <PixelButton type="submit" disabled={busy}>
        {mode === "signin" ? "Sign in" : "Create account"}
      </PixelButton>
      <PixelButton type="button" variant="ghost" onClick={google} disabled={busy}>
        Continue with Google
      </PixelButton>
      <button
        type="button"
        className="cursor-pointer text-steel underline"
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
        }}
      >
        {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </form>
  );
}
