import { PixelPanel } from "@/components/pixel/PixelPanel";
import { PageShell } from "./PageShell";

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <PageShell title={title}>
      <PixelPanel title="Coming soon">
        <p className="text-xl text-paper">{text}</p>
        <p className="mt-3 text-lg text-steel">We are still building this part. Check back soon!</p>
      </PixelPanel>
    </PageShell>
  );
}
