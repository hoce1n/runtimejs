import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronRight, Play } from "lucide-react";
import { Group, Panel, Separator, useDefaultLayout } from "react-resizable-panels";
import { ERAS, type Concept } from "@/lib/js-eras";
import { getProgress, isConceptDone, toggleConcept } from "@/lib/progress";
import { panelLayoutStorage } from "@/lib/panel-layout";
import { useMediaQuery } from "@/hooks/use-media-query";
import { CodeBlock } from "./CodeBlock";
import { CopyButton } from "./CopyButton";

const ALL_CONCEPT_IDS = ERAS.flatMap((era) => era.concepts.map((concept) => concept.id));

/**
 * Client-only "understood" tracking. Initialised empty so server-rendered
 * HTML and the hydration pass agree; the real set is read from localStorage
 * once the effect runs in the browser.
 */
function useConceptProgress() {
  const [done, setDone] = useState<Set<string>>(() => new Set());
  const [total] = useState(() => getProgress().total);

  useEffect(() => {
    setDone(new Set(ALL_CONCEPT_IDS.filter((id) => isConceptDone(id))));
  }, []);

  const toggle = useCallback((conceptId: string) => {
    toggleConcept(conceptId);
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(conceptId)) {
        next.delete(conceptId);
      } else {
        next.add(conceptId);
      }
      return next;
    });
  }, []);

  return { done, total, toggle };
}

const RUNTIME_COLOR: Record<string, string> = {
  V8: "text-warning",
  "Node.js": "text-success",
  Deno: "text-foreground",
  Bun: "text-primary",
};

export function Timeline({
  activeEra,
  expandedConcept,
  onSelectEra,
  onToggleConcept,
  onRun,
}: {
  activeEra: string;
  expandedConcept: string | null;
  onSelectEra: (eraId: string) => void;
  onToggleConcept: (conceptId: string | null) => void;
  onRun: (code: string) => void;
}) {
  const era = ERAS.find((e) => e.id === activeEra) ?? ERAS[0]!;
  const railRef = useRef<HTMLElement | null>(null);
  const { done, total, toggle } = useConceptProgress();
  const isWide = useMediaQuery("(min-width: 768px)");
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: "timeline-split",
    panelIds: ["timeline-rail", "timeline-content"],
    storage: panelLayoutStorage,
  });

  const onRailKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown" && e.key !== "Home" && e.key !== "End") {
      return;
    }
    const buttons = Array.from(
      railRef.current?.querySelectorAll<HTMLButtonElement>("[data-era]") ?? [],
    );
    const current = buttons.findIndex((b) => b.dataset["era"] === era.id);
    if (current === -1 || buttons.length === 0) return;
    e.preventDefault();
    let next: number;
    if (e.key === "Home") next = 0;
    else if (e.key === "End") next = buttons.length - 1;
    else if (e.key === "ArrowDown") next = (current + 1) % buttons.length;
    else next = (current - 1 + buttons.length) % buttons.length;
    const target = buttons[next];
    const id = target?.dataset["era"];
    if (!id) return;
    target.focus();
    onSelectEra(id);
  };

  const railBody = (
    <nav
      ref={railRef}
      onKeyDown={onRailKeyDown}
      className="bg-panel p-2"
      aria-label="JavaScript eras"
    >
      <p className="flex items-baseline justify-between gap-2 px-2 pb-2 pt-1 text-[10.5px] uppercase tracking-widest text-muted-foreground">
        <span>Timeline</span>
        <span className="normal-case tracking-normal">
          {done.size} / {total} concepts
        </span>
      </p>
      <ol className="space-y-px">
        {ERAS.map((e, i) => {
          const active = e.id === era.id;
          return (
            <li key={e.id}>
              <button
                onClick={() => onSelectEra(e.id)}
                data-era={e.id}
                aria-current={active ? "true" : undefined}
                className={`flex w-full items-center gap-2 border-l-2 px-2.5 py-2 text-left text-xs transition-colors ${
                  active
                    ? "border-l-primary bg-accent text-foreground"
                    : "border-l-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground active:bg-accent/70"
                }`}
              >
                <span className="w-4 shrink-0 text-[10px] text-muted-foreground">
                  {String(i).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{e.label}</span>
                  <span className="block truncate text-[10.5px] text-muted-foreground">
                    {e.years}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );

  const contentBody = (
    <div className="bg-card">
      <article key={era.id} className="p-5 md:p-7">
        <header className="border-b border-border pb-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="text-xl font-bold text-primary">{era.label}</h2>
            <span className="rounded-sm border border-secondary/50 px-1.5 py-0.5 text-[10.5px] text-secondary">
              {era.spec}
            </span>
            <span className="text-xs text-muted-foreground">{era.years}</span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-panel-foreground">
            {era.summary}
          </p>
        </header>

        <div className="divide-y divide-border">
          {era.concepts.map((concept) => (
            <ConceptRow
              key={concept.id}
              concept={concept}
              open={expandedConcept === concept.id}
              done={done.has(concept.id)}
              onMark={() => toggle(concept.id)}
              onToggle={() => onToggleConcept(expandedConcept === concept.id ? null : concept.id)}
              onRun={onRun}
            />
          ))}
        </div>
      </article>
    </div>
  );

  if (isWide) {
    return (
      <Group
        orientation="horizontal"
        defaultLayout={defaultLayout}
        onLayoutChanged={onLayoutChanged}
        resizeTargetMinimumSize={{ coarse: 20, fine: 8 }}
      >
        <Panel id="timeline-rail" defaultSize={220} minSize={140} maxSize={480}>
          {railBody}
        </Panel>
        <Separator className="w-px shrink-0 bg-border transition-colors data-[separator=hover]:bg-secondary/70 data-[separator=active]:bg-secondary" />
        <Panel id="timeline-content" minSize="25">
          {contentBody}
        </Panel>
      </Group>
    );
  }

  return (
    <div className="grid gap-px bg-border">
      {railBody}
      {contentBody}
    </div>
  );
}

function ConceptRow({
  concept,
  open,
  done,
  onMark,
  onToggle,
  onRun,
}: {
  concept: Concept;
  open: boolean;
  done: boolean;
  onMark: () => void;
  onToggle: () => void;
  onRun: (code: string) => void;
}) {
  return (
    <section className="py-4">
      <div className="flex items-center gap-2">
        <button
          onClick={onMark}
          aria-pressed={done}
          aria-label={`${done ? "Mark as not understood" : "Mark as understood"}: ${concept.name}`}
          title={done ? "Mark as not understood" : "Mark as understood"}
          className={`grid size-4 shrink-0 place-items-center rounded-[3px] border transition-colors ${
            done
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-border text-muted-foreground/0 hover:border-secondary hover:text-secondary"
          }`}
        >
          <Check className="size-3" strokeWidth={2.5} />
        </button>
        <button
          onClick={onToggle}
          aria-expanded={open}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-accent/40 active:bg-accent/60"
        >
          <ChevronRight
            className={`size-4 shrink-0 text-muted-foreground transition-all group-hover:text-foreground ${open ? "rotate-90 text-foreground" : ""}`}
          />
          <h3
            className={`truncate text-sm ${
              done
                ? "font-normal text-muted-foreground line-through decoration-muted-foreground/40"
                : "font-medium text-foreground"
            }`}
          >
            {concept.name}
          </h3>
          {concept.ecosystem && (
            <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">
              + runtime comparison
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-4 pl-6">
          <p className="max-w-3xl text-[13px] leading-relaxed text-panel-foreground">
            {concept.blurb}
          </p>

          <div className="relative max-w-3xl">
            <CodeBlock code={concept.code} />
            <button
              onClick={() => onRun(concept.code)}
              className="absolute right-24 top-2 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Play className="size-3" /> run in console
            </button>
          </div>

          {concept.ecosystem && (
            <div className="max-w-3xl overflow-hidden rounded-sm border border-border">
              <div className="border-b border-border bg-panel px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                {concept.ecosystem.title}
              </div>
              <table className="w-full border-collapse text-left text-[12px]">
                <tbody>
                  {concept.ecosystem.rows.map((row) => (
                    <tr key={row.runtime} className="border-b border-border last:border-0">
                      <th
                        scope="row"
                        className={`w-20 border-r border-border px-3 py-2 align-top font-medium md:w-24 md:whitespace-nowrap ${
                          RUNTIME_COLOR[row.runtime] ?? "text-foreground"
                        }`}
                      >
                        {row.runtime}
                      </th>
                      <td className="px-3 py-2 leading-relaxed text-panel-foreground">
                        {row.note}
                        {row.code && (
                          <div className="relative mt-1.5">
                            <pre className="overflow-x-auto rounded-sm border border-border/60 bg-panel/80 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-panel-foreground">
                              <code>{row.code.trim()}</code>
                            </pre>
                            <CopyButton
                              text={row.code.trim()}
                              label={`Copy ${row.runtime} snippet`}
                              className="absolute right-1.5 top-1.5"
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
