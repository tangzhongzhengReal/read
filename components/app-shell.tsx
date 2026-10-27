import { Library } from "@/components/library";

export function AppShell() {
  return (
    <div data-testid="app-shell" className="min-h-svh overflow-x-clip bg-canvas text-[#1C1C1E]">
      <Library />
    </div>
  );
}
