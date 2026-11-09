import { PixelPanel } from "@/components/pixel/PixelPanel";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <PixelPanel title="Hustle Royale" className="w-full max-w-sm">
        <LoginForm />
      </PixelPanel>
    </main>
  );
}
