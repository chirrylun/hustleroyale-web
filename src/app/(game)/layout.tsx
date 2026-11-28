import type { ReactNode } from "react";
import { ChatDock } from "@/components/chat/ChatDock";

/** Every game screen gets the chat icon at the top right. */
export default function GameLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ChatDock />
    </>
  );
}
