import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Uses the public key, so it can only do what RLS allows (read your own data). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
