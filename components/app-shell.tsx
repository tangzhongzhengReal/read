import { Library } from "@/components/library";

export function AppShell() {
  return (
    <div
      data-testid="app-shell"
      className="min-h-svh bg-background text-foreground"
    >
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-6 py-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
            R
          </div>
          <div>
            <p className="text-xs tracking-wide text-muted-foreground">文库</p>
            <h1 className="text-xl leading-none font-semibold">Read</h1>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Library />
      </main>
    </div>
  );
}
