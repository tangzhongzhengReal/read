import { Library } from "@/components/library";
import { LogoutButton } from "@/components/logout-button";

export function AppShell() {
  return (
    <div
      data-testid="app-shell"
      className="min-h-svh overflow-x-clip bg-background text-foreground"
    >
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
              R
            </div>
            <div>
              <p className="text-xs tracking-wide text-muted-foreground">文库</p>
              <h1 className="text-xl leading-none font-semibold">Read</h1>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Library />
      </main>
    </div>
  );
}
