import { lazy, Suspense, useEffect, useState } from "react";
import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { REPL_EXAMPLES } from "@/lib/js-eras";
import { INTERVIEW_PATTERNS } from "@/lib/interview-patterns";

const Workbench = lazy(() => import("@/components/devtools/Workbench"));

type EmbedView = "console" | "loop";

const DEFAULT_CODE = REPL_EXAMPLES[0]!.code;

/** Resolve an example/pattern id to code, falling back to the first REPL example. */
function codeForExample(example?: string): string {
  if (!example) return DEFAULT_CODE;
  const repl = REPL_EXAMPLES.find((e) => e.id === example);
  if (repl) return repl.code;
  const pattern = INTERVIEW_PATTERNS.find((p) => p.id === example);
  if (pattern) return pattern.code;
  return DEFAULT_CODE;
}

function labelForExample(example?: string): string | undefined {
  if (!example) return undefined;
  return (
    REPL_EXAMPLES.find((e) => e.id === example)?.label ??
    INTERVIEW_PATTERNS.find((p) => p.id === example)?.title
  );
}

export const Route = createFileRoute("/embed")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { example?: string | undefined; view: EmbedView } => {
    const example = typeof search["example"] === "string" ? search["example"] : undefined;
    return {
      ...(example !== undefined ? { example } : {}),
      view: search["view"] === "loop" ? "loop" : "console",
    };
  },
  head: () => ({
    meta: [
      { title: "Embeddable REPL — runtime.js" },
      {
        name: "description",
        content:
          "A small embeddable sandboxed REPL and event loop visualizer. Drop it into any page with an iframe.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Embed,
});

function Embed() {
  const { example, view: searchView } = Route.useSearch();
  const [code, setCode] = useState(() => codeForExample(example));
  const [view, setView] = useState<EmbedView>(searchView);

  // React to ?example= / ?view= changes without a reload (e.g. SPA links).
  useEffect(() => {
    setCode(codeForExample(example));
  }, [example]);

  useEffect(() => {
    setView(searchView);
  }, [searchView]);

  const exampleLabel = labelForExample(example);

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-panel px-3 py-1.5">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-sm"
          aria-label="runtime.js — back to the full site"
        >
          <span className="grid size-4 place-items-center rounded-[3px] bg-primary text-[9px] font-bold text-primary-foreground">
            JS
          </span>
          <span className="text-xs font-bold tracking-tight">
            runtime<span className="text-muted-foreground">.js</span>
          </span>
        </a>

        {exampleLabel && (
          <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground sm:block">
            {exampleLabel}
          </span>
        )}

        <div className="ml-auto flex overflow-hidden rounded-sm border border-border">
          {(["console", "loop"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-2.5 py-1 text-[11px] transition-colors ${
                view === v
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "console" ? "console" : "event loop"}
            </button>
          ))}
        </div>
      </header>

      <main className="min-h-0 flex-1 p-2 sm:p-3">
        <ClientOnly fallback={<EmbedFallback>booting sandbox…</EmbedFallback>}>
          <Suspense fallback={<EmbedFallback>loading editor…</EmbedFallback>}>
            <Workbench code={code} onCodeChange={setCode} view={view} />
          </Suspense>
        </ClientOnly>
      </main>

      <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-border bg-panel px-3 py-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-sm text-[10.5px] font-medium text-muted-foreground transition-colors hover:text-primary"
        >
          via runtime.js
        </a>
      </footer>
    </div>
  );
}

function EmbedFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[300px] items-center justify-center rounded-sm border border-border bg-card p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
