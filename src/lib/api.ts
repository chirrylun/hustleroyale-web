import { createClient } from "@/lib/supabase/client";

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

/** POST to the game server with the player's Supabase token. Throws ApiError on a non-2xx reply. */
export async function gameApi<T = unknown>(path: string, body: unknown, opts: { keepalive?: boolean } = {}): Promise<T> {
  const { data } = await createClient().auth.getSession();
  const res = await fetch(`${process.env.NEXT_PUBLIC_GAME_SERVER_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
    keepalive: opts.keepalive,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (json as { error?: string }).error ?? "request_failed");
  return json as T;
}
