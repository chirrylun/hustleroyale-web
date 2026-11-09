import { io, type Socket } from "socket.io-client";
import { createClient } from "@/lib/supabase/client";

let socket: Socket | null = null;

/**
 * Singleton connection to the game server. The Supabase access token is read fresh on every
 * (re)connect, and the server only trusts the identity it verifies from that token.
 */
export function getGameSocket(): Socket {
  if (!socket) {
    const supabase = createClient();
    socket = io(process.env.NEXT_PUBLIC_GAME_SERVER_URL!, {
      autoConnect: false,
      transports: ["websocket", "polling"],
      auth: (cb) => {
        supabase.auth.getSession().then(({ data }) => cb({ token: data.session?.access_token }));
      },
    });
  }
  return socket;
}
