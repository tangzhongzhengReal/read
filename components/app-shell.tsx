import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
        <Card data-testid="library-empty">
          <CardHeader>
            <CardTitle>还没有文档</CardTitle>
            <CardDescription>
              导入 PDF 或 EPUB 后，可以在这里阅读、摘录，并回到原文。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">文库是空的。</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
