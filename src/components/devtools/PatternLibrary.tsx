import { useEffect, useState } from "react";
import { ChevronRight, Play } from "lucide-react";
import {
  CATEGORY_LABEL,
  CATEGORY_ORDER,
  INTERVIEW_PATTERNS,
  type InterviewPattern,
} from "@/lib/interview-patterns";
import { gotchaForDate } from "@/lib/gotcha-of-the-day";
import { CodeBlock } from "./CodeBlock";

const DIFFICULTY_COLOR: Record<InterviewPattern["difficulty"], string> = {
  easy: "text-success",
  medium: "text-warning",
  hard: "text-destructive",
};

/** Client-only: picks today's gotcha after mount so SSR and hydration agree. */
function useGotchaOfTheDay() {
  const [gotcha, setGotcha] = useState<InterviewPattern | null>(null);
  useEffect(() => {
    setGotcha(gotchaForDate(new Date()));
  }, []);
  return gotcha;
}

export function PatternLibrary({
  onRun,
  focusedPattern,
  onConsumeFocusedPattern,
}: {
  onRun: (code: string) => void;
  focusedPattern?: string | undefined;
  onConsumeFocusedPattern?: (() => void) | undefined;
}) {
  const total = INTERVIEW_PATTERNS.length;
  const gotcha = useGotchaOfTheDay();
  const [localFocus, setLocalFocus] = useState<string | null>(null);

  return (
    <section aria-label="Interview question patterns">
      <div className="mb-3 max-w-3xl">
        <h2 className="text-lg font-bold">
          Interview <span className="text-primary">gotchas</span>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-panel-foreground">
          {total} genuinely tricky, well-known snippets — event-loop ordering, closures in loops,
          and `this`-binding traps. Open one, read the gotcha, then drop it straight into the
          sandboxed console to watch it really run.
        </p>
      </div>

      {gotcha && <GotchaCard pattern={gotcha} onFocus={() => setLocalFocus(gotcha.id)} />}

      <div className="overflow-hidden rounded-sm border border-border bg-card">
        {CATEGORY_ORDER.map((category) => {
          const patterns = INTERVIEW_PATTERNS.filter((p) => p.category === category);
          if (patterns.length === 0) return null;
          return (
            <div key={category} className="border-b border-border last:border-0">
              <div className="border-b border-border bg-panel px-3 py-2 text-[11px] uppercase tracking-widest text-muted-foreground">
                {CATEGORY_LABEL[category]}
              </div>
              <div className="divide-y divide-border">
                {patterns.map((pattern) => (
                  <PatternRow
                    key={pattern.id}
                    pattern={pattern}
                    onRun={onRun}
                    focused={focusedPattern === pattern.id || localFocus === pattern.id}
                    onConsumeFocus={() => {
                      if (localFocus === pattern.id) {
                        setLocalFocus(null);
                      } else {
                        onConsumeFocusedPattern?.();
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function GotchaCard({ pattern, onFocus }: { pattern: InterviewPattern; onFocus: () => void }) {
  return (
    <button
      onClick={onFocus}
      title={`Jump to "${pattern.title}"`}
      className="group mb-4 block w-full max-w-3xl rounded-sm border border-border bg-card px-3 py-2.5 text-left transition-colors hover:border-primary/60 hover:bg-accent/30 active:bg-accent/50"
    >
      <span className="flex items-center gap-2">
        <span className="text-[10.5px] uppercase tracking-widest text-secondary">
          Today&apos;s gotcha
        </span>
        <ChevronRight className="ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className="mt-1 block text-sm font-medium text-foreground">{pattern.title}</span>
    </button>
  );
}

function PatternRow({
  pattern,
  onRun,
  focused,
  onConsumeFocus,
}: {
  pattern: InterviewPattern;
  onRun: (code: string) => void;
  focused: boolean;
  onConsumeFocus?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!focused) return;
    setOpen(true);
    document
      .getElementById(`pattern-row-${pattern.id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
    onConsumeFocus?.();
  }, [focused, pattern.id, onConsumeFocus]);

  return (
    <section
      id={`pattern-row-${pattern.id}`}
      className="px-3 py-3 transition-colors hover:bg-accent/30"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="group flex w-full items-center gap-2 rounded-sm px-1 py-1 text-left transition-colors hover:bg-accent/40 active:bg-accent/60"
      >
        <ChevronRight
          className={`size-4 shrink-0 text-muted-foreground transition-all group-hover:text-foreground ${open ? "rotate-90 text-foreground" : ""}`}
        />
        <h3 className="text-sm font-medium text-foreground">{pattern.title}</h3>
        <span
          className={`ml-auto shrink-0 rounded-sm border border-border px-1.5 py-0.5 text-[10.5px] ${DIFFICULTY_COLOR[pattern.difficulty]}`}
        >
          {pattern.difficulty}
        </span>
      </button>

      {open && (
        <div className="mt-3 space-y-4 pl-6">
          <p className="max-w-3xl text-[13px] leading-relaxed text-muted-foreground">
            <span className="text-secondary">Q:</span> {pattern.question}
          </p>

          <div className="relative max-w-3xl">
            <CodeBlock code={pattern.code} />
            <button
              onClick={() => onRun(pattern.code)}
              className="absolute right-24 top-2 inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <Play className="size-3" /> run in console
            </button>
          </div>

          <p className="max-w-3xl text-[13px] leading-relaxed text-panel-foreground">
            <span className="text-secondary">A:</span> {pattern.answer}
          </p>
        </div>
      )}
    </section>
  );
}
