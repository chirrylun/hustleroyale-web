import { LiveBackdrop } from "@/components/home/LiveBackdrop";
import { Music } from "@/components/Music";
import { PixelPanel } from "@/components/pixel/PixelPanel";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <>
    <Music track="intro" />
    <LiveBackdrop />
    <main className="relative z-10 flex flex-1 items-center justify-center p-6">
      <PixelPanel title="Pocket RPG" className="w-full max-w-sm">
        <LoginForm />
      </PixelPanel>
    </main>
    </>
  );
}
