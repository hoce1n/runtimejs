import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Square, Zap, Terminal, Trash2, Link2, Check } from "lucide-react";
import { useSandbox } from "@/hooks/use-sandbox";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePresence } from "@/hooks/use-presence";
import { deriveState, describeEvent } from "@/lib/event-loop";
import { LoopDiagram } from "./LoopDiagram";
import { REPL_EXAMPLES } from "@/lib/js-eras";
import { buildShareUrl, copyText } from "@/lib/share";
import { track } from "@/lib/analytics";

// CodeMirror is the heaviest dependency in the Workbench — keep it in its own
// async chunk so the rest of the sandbox UI loads before the editor.
const CodeEditor = lazy(() => import("./CodeEditor"));

type Props = {
  code: string;
  onCodeChange: (code: string) => void;
  view: "console" | "loop";
};

export default function Workbench({ code, onCodeChange, view }: Props) {
  const { hostRef, status, trace, run, reset } = useSandbox();
  const [mode, setMode] = useState<"run" | "step">("run");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [consoleClearSeq, setConsoleClearSeq] = useState(0);
  const [copiedLink, setCopiedLink] = useState(false);
  const logRef = useRef<HTMLDivElement | null>(null);
  const linkResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (mode === "run") setCursor(trace.length);
  }, [trace, mode]);

  useEffect(() => {
    if (trace.length === 0) setConsoleClearSeq(0);
  }, [trace.length]);

  // Autoplay: advance the cursor through the recorded trace.
  useEffect(() => {
    if (!playing) return;
    const intervalMs = Math.max(40, 150 / speed);
    const id = setInterval(() => {
      setCursor((c) => Math.min(trace.length, c + 1));
    }, intervalMs);
    return () => clearInterval(id);
  }, [playing, speed, trace.length]);

  // Stop the replay once it reaches the end of the trace.
  useEffect(() => {
    if (playing && cursor >= trace.length) setPlaying(false);
  }, [playing, cursor, trace.length]);

  // Leaving step mode or starting a new run stops any replay.
  useEffect(() => {
    if (mode !== "step" || status === "running") setPlaying(false);
  }, [mode, status]);

  useEffect(
    () => () => {
      if (linkResetTimer.current) clearTimeout(linkResetTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (mode === "step" && status === "running") setCursor(0);
  }, [status, mode]);

  const state = useMemo(() => deriveState(trace, cursor), [trace, cursor]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [state.logs.length]);

  const recording = mode === "step" && status === "running";
  const canStep = mode === "step" && trace.length > 0 && status !== "running";
  const lastEvent = cursor > 0 ? trace[cursor - 1] : undefined;
  const prevEvent = cursor > 1 ? trace[cursor - 2] : undefined;

  const handleRun = () => {
    setCursor(0);
    setPlaying(false);
    run(code);
    track("run", { mode });
  };

  const handleClearConsole = () => {
    const lastSeq = state.logs.reduce((max, l) => Math.max(max, l.seq), 0);
    setConsoleClearSeq(lastSeq);
  };

  const handleRunRef = useRef(handleRun);
  handleRunRef.current = handleRun;
  const handleClearRef = useRef(handleClearConsole);
  handleClearRef.current = handleClearConsole;

  // Global shortcuts: ⌘/Ctrl+Enter to run, ⌘/Ctrl+K to clear the console.
  // Mod+Enter inside the editor is handled by CodeMirror, so skip it here to
  // avoid double-running; the window handler covers every other focus point.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const key = e.key.toLowerCase();
      if (key === "k") {
        e.preventDefault();
        handleClearRef.current();
      } else if (key === "enter") {
        const target = e.target as HTMLElement | null;
        if (target && target.closest(".cm-editor")) return;
        e.preventDefault();
        handleRunRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleShare = async () => {
    await copyText(buildShareUrl(code));
    setCopiedLink(true);
    track("share");
    if (linkResetTimer.current) clearTimeout(linkResetTimer.current);
    linkResetTimer.current = setTimeout(() => setCopiedLink(false), 1500);
  };

  const hasVisibleLogs = state.logs.some((l) => l.seq > consoleClearSeq);

  return (
    <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border lg:grid-cols-2">
      {/* editor column */}
      <div className="flex h-[300px] flex-col bg-card lg:h-[520px]">
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-3 py-2">
          <button
            onClick={handleRun}
            disabled={status === "booting"}
            title="Run (Ctrl/Cmd+Enter)"
            className="inline-flex items-center gap-1.5 rounded-sm bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-40"
          >
            <Play className="size-3.5" />
            {mode === "step" ? "Record" : "Run"}
          </button>

          <div className="flex overflow-hidden rounded-sm border border-border">
            {(["run", "step"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setCursor(m === "run" ? trace.length : 0);
                }}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  mode === m
                    ? "bg-secondary text-secondary-foreground"
                    : "bg-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "run" ? "live" : "step"}
              </button>
            ))}
          </div>

          <select
            aria-label="Load example"
            className="rounded-sm border border-border bg-card px-2 py-1 text-xs text-muted-foreground outline-none focus:border-secondary"
            value=""
            onChange={(e) => {
              const found = REPL_EXAMPLES.find((x) => x.id === e.target.value);
              if (found) {
                onCodeChange(found.code);
                reset();
                setCursor(0);
                track("load_example", { id: found.id });
              }
            }}
          >
            <option value="">examples…</option>
            {REPL_EXAMPLES.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              reset();
              setCursor(0);
            }}
            className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <RotateCcw className="size-3.5" /> clear
          </button>

          <button
            onClick={handleShare}
            title="Copy a share link with this code embedded"
            className="inline-flex items-center gap-1.5 rounded-sm border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {copiedLink ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {copiedLink ? "copied" : "share"}
          </button>

          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span
              className={`size-1.5 rounded-full ${
                status === "running"
                  ? "bg-warning"
                  : status === "timeout"
                    ? "bg-destructive"
                    : status === "booting"
                      ? "bg-muted-foreground"
                      : "bg-success"
              }`}
            />
            sandbox: {status}
            <span className="ml-1 hidden rounded-sm border border-border px-1 py-px text-[10px] sm:inline">
              ⌘/Ctrl⏎ run · ⌘/CtrlK clear
            </span>
          </span>
        </div>

        <div className="min-h-0 flex-1">
          <Suspense
            fallback={
              <div className="flex h-full min-h-[220px] items-center justify-center text-sm text-muted-foreground">
                loading editor…
              </div>
            }
          >
            <CodeEditor
              value={code}
              onChange={onCodeChange}
              onRun={handleRun}
              activeLine={state.currentLine ?? null}
              minHeight={isMobile ? "140px" : "380px"}
            />
          </Suspense>
        </div>

        {canStep && (
          <div className="flex items-center gap-2 border-t border-border bg-panel px-3 py-2">
            <button
              onClick={() => {
                if (cursor >= trace.length) setCursor(0);
                setPlaying((p) => !p);
              }}
              aria-label={playing ? "Pause replay" : "Play replay"}
              title={playing ? "Pause replay" : "Replay the trace (autoplay)"}
              className={`inline-flex items-center gap-1 rounded-sm border px-2 py-1 text-xs transition-colors ${
                playing
                  ? "border-warning/60 text-warning"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {playing ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {playing ? "pause" : "play"}
            </button>
            <select
              aria-label="Replay speed"
              title="Replay speed"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded-sm border border-border bg-card px-1.5 py-1 text-[11px] text-muted-foreground outline-none focus:border-secondary"
            >
              <option value={0.25}>0.25×</option>
              <option value={0.5}>0.5×</option>
              <option value={1}>1×</option>
              <option value={2}>2×</option>
              <option value={4}>4×</option>
            </select>
            <button
              onClick={() => setCursor((c) => Math.max(0, c - 1))}
              className="rounded-sm border border-border p-1 text-muted-foreground hover:text-foreground"
              aria-label="Step backward"
            >
              <SkipBack className="size-3.5" />
            </button>
            <button
              onClick={() => setCursor((c) => Math.min(trace.length, c + 1))}
              className="rounded-sm border border-border p-1 text-muted-foreground hover:text-foreground"
              aria-label="Step forward"
            >
              <SkipForward className="size-3.5" />
            </button>
            <input
              type="range"
              min={0}
              max={trace.length}
              value={cursor}
              onChange={(e) => setCursor(Number(e.target.value))}
              aria-label="Execution step"
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-accent accent-primary"
            />
            <span className="w-20 shrink-0 text-right text-[11px] text-muted-foreground">
              {cursor} / {trace.length}
            </span>
          </div>
        )}

        {canStep && (
          <div className="border-t border-border bg-card px-3 py-2 text-[11.5px] text-panel-foreground">
            <span className="text-secondary">step&gt;</span>{" "}
            {lastEvent ? describeEvent(lastEvent) : "before first instruction"}
            {lastEvent && (
              <span className="ml-1 text-muted-foreground">
                · at {lastEvent.t.toFixed(1)}ms
                {cursor > 1 && prevEvent
                  ? ` (+${(lastEvent.t - prevEvent.t).toFixed(1)}ms)`
                  : ""}
              </span>
            )}
          </div>
        )}
      </div>

      {/* output column */}
      <div className="flex h-[300px] flex-col bg-card lg:h-[520px]">
        <div className="flex items-center gap-2 border-b border-border bg-panel px-3 py-2 text-xs text-muted-foreground">
          {view === "console" ? <Terminal className="size-3.5" /> : <Zap className="size-3.5" />}
          {view === "console" ? "Console output" : "Event loop — live instrumentation"}
          {recording && <span className="ml-auto text-warning">recording…</span>}
          {view === "console" ? (
            <button
              onClick={handleClearConsole}
              disabled={!hasVisibleLogs}
              title="Clear console output (⌘/Ctrl+K)"
              className={`inline-flex items-center gap-1 rounded-sm border border-border px-1.5 py-0.5 text-[11px] transition-colors hover:text-foreground disabled:opacity-40 ${
                recording ? "" : "ml-auto"
              }`}
            >
              <Trash2 className="size-3" /> clear
            </button>
          ) : null}
        </div>

        {view === "console" ? (
          <ConsolePanel
            logs={state.logs}
            clearAfterSeq={consoleClearSeq}
            logRef={logRef}
            status={status}
            traceLength={trace.length}
          />
        ) : (
          <LoopPanel state={state} traceLength={trace.length} />
        )}
      </div>

      <div ref={hostRef} aria-hidden className="hidden" />
    </div>
  );
}

function ConsolePanel({
  logs,
  clearAfterSeq,
  logRef,
  status,
  traceLength,
}: {
  logs: ReturnType<typeof deriveState>["logs"];
  clearAfterSeq: number;
  logRef: React.RefObject<HTMLDivElement | null>;
  status: string;
  traceLength: number;
}) {
  const MAX_RENDERED_LOGS = 1000;
  const visibleLogs = logs.filter((log) => log.seq > clearAfterSeq);
  const cleared = clearAfterSeq > 0;
  const hidden = Math.max(0, visibleLogs.length - MAX_RENDERED_LOGS);
  const shown = hidden > 0 ? visibleLogs.slice(visibleLogs.length - MAX_RENDERED_LOGS) : visibleLogs;
  return (
    <>
      <p className="border-b border-border/60 bg-panel/60 px-3 py-1 text-[11px] text-muted-foreground">
        fetch is mocked in this sandbox — no network access.
      </p>
    <div ref={logRef} className="min-h-0 flex-1 overflow-auto px-3 py-2 text-[12.5px] leading-relaxed">

      {visibleLogs.length === 0 && logs.length === 0 && traceLength === 0 && (
        <p className="text-muted-foreground">
          <span className="text-secondary">&gt;</span> nothing logged yet — hit Run.
        </p>
      )}
      {visibleLogs.length === 0 && logs.length === 0 && traceLength > 0 && status !== "running" && !cleared && (
        <p className="text-muted-foreground">
          <span className="text-secondary">&gt;</span> executed with no console output.
        </p>
      )}
      {cleared && visibleLogs.length === 0 && logs.length > 0 && (
        <p className="text-muted-foreground">
          <span className="text-secondary">&gt;</span> console cleared — rerun to capture more output.
        </p>
      )}
      {hidden > 0 && (
        <p className="mb-1 border-b border-border/40 py-1 text-[11px] text-warning">
          output truncated — {hidden} earlier line{hidden === 1 ? "" : "s"} hidden (showing last{" "}
          {MAX_RENDERED_LOGS})
        </p>
      )}
      {shown.map((log) => (
        <div
          key={log.seq}
          className={`flex gap-2 border-b border-border/40 py-1 font-mono ${
            log.level === "error"
              ? "text-destructive"
              : log.level === "warn"
                ? "text-warning"
                : "text-foreground"
          }`}
        >
          <span className="select-none text-muted-foreground">
            {log.level === "error" ? "✕" : log.level === "warn" ? "▲" : "›"}
          </span>
          <pre className="whitespace-pre-wrap break-words">{log.text}</pre>
        </div>
      ))}
    </div>
    </>
  );

}

function LoopPanel({
  state,
  traceLength,
}: {
  state: ReturnType<typeof deriveState>;
  traceLength: number;
}) {
  const [view, setView] = useState<"text" | "diagram">("text");

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-panel px-3 py-1.5">
        <span className="text-[10.5px] uppercase tracking-widest text-muted-foreground">
          view
        </span>
        <div className="flex overflow-hidden rounded-sm border border-border">
          {(["text", "diagram"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`px-2 py-0.5 text-[11px] transition-colors ${
                view === v
                  ? "bg-secondary text-secondary-foreground"
                  : "bg-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {v === "text" ? "lanes" : "diagram"}
            </button>
          ))}
        </div>
        {state.heap && (
          <span className="ml-auto text-[11px]">
            heap {(state.heap.used / 1048576).toFixed(1)} MB
          </span>
        )}
      </div>

      {view === "diagram" ? (
        <LoopDiagram state={state} traceLength={traceLength} />
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[1fr_1fr_1fr_1fr_auto] divide-y divide-border">
          <Lane
            title="Call Stack"
            hint="LIFO — top frame is executing"
            color="text-stack"
            border="border-l-stack"
            items={[...state.stack].reverse().map((f) => ({
              key: f.key,
              label: f.name + (f.line ? `  · line ${f.line}` : ""),
            }))}
            empty={traceLength === 0 ? "idle" : "empty — run to completion"}
          />
          <Lane
            title="Web APIs"
            hint="in-flight handles — timers, fetch"
            color="text-api"
            border="border-l-api"
            items={state.pending.map((p) => ({ key: `p${p.id}`, label: p.label }))}
            empty="no pending handles"
          />
          <Lane
            title="Microtask Queue"
            hint="drains fully before the next task"
            color="text-microtask"
            border="border-l-microtask"
            items={state.microtasks.map((m) => ({ key: `m${m.id}`, label: m.label }))}
            empty="empty"
          />
          <Lane
            title="Macrotask Queue"
            hint="one task per loop turn"
            color="text-macrotask"
            border="border-l-macrotask"
            items={state.macrotasks.map((m) => ({ key: `M${m.id}`, label: m.label }))}
            empty="empty"
          />
        </div>
      )}

      <div className="bg-panel px-3 py-2 text-[11px] text-muted-foreground">
        {traceLength === 0
          ? "No trace recorded. Every frame and queue entry below comes from your code's real execution."
          : `${traceLength} instrumented events recorded${
              state.elapsedMs !== undefined ? ` · ${state.elapsedMs.toFixed(2)}ms elapsed` : ""
            }${state.completed ? " · queues drained" : ""}`}
      </div>
    </div>
  );
}

function Lane({
  title,
  hint,
  color,
  border,
  items,
  empty,
}: {
  title: string;
  hint: string;
  color: string;
  border: string;
  items: { key: string; label: string }[];
  empty: string;
}) {
  const presence = usePresence(items);

  return (
    <section aria-label={title} className="min-h-0 overflow-auto p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <h3 className={`text-[11px] font-bold uppercase tracking-widest ${color}`}>{title}</h3>
        <span className="text-[10.5px] text-muted-foreground">{hint}</span>
      </div>
      {presence.length === 0 ? (
        <p className="text-[11.5px] text-muted-foreground/70">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {presence.map((item) => (
            <li
              key={item.key}
              className={`truncate border-l-2 bg-accent/50 px-2 py-1 text-[11.5px] ${
                item.phase === "leave"
                  ? "token-leaving"
                  : item.phase === "enter"
                    ? "token-entering"
                    : ""
              } ${border}`}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
