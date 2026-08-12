import type { LoopState, QueueItem, StackFrame } from "./event-loop";

/**
 * Per-trace PNG card renderer.
 *
 * Draws a fixed 1200x630 card straight from `LoopState` with the Canvas 2D
 * API — deliberately NOT a DOM screenshot. The card uses the app's dark
 * DevTools palette (hardcoded here, never read from CSS) so every exported
 * image looks identical regardless of the visitor's local theme.
 *
 * The pure helpers (planLane / snippetAround / formatTraceLabel) are exported
 * so layout decisions are unit-testable without a canvas context.
 */

export const TRACE_CARD_WIDTH = 1200;
export const TRACE_CARD_HEIGHT = 630;

const MAX_STACK_FRAMES = 8;
const MAX_QUEUE_ITEMS = 7;
const SNIPPET_LINES = 4;
const MAX_DPR = 3;

const FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace';

/** Dark DevTools palette — mirrors the `.dark` block in src/styles.css. */
const C = {
  bg: "oklch(0.2 0.004 260)",
  card: "oklch(0.24 0.005 260)",
  accent: "oklch(0.31 0.008 260)",
  border: "oklch(0.31 0.007 260)",
  gridLine: "oklch(0.28 0.006 260)",
  foreground: "oklch(0.86 0.008 260)",
  muted: "oklch(0.79 0.014 258)",
  panelFg: "oklch(0.79 0.01 260)",
  primary: "oklch(0.892 0.181 102.4)",
  primaryFg: "oklch(0.18 0.004 260)",
  stack: "oklch(0.892 0.181 102.4)",
  microtask: "oklch(0.8 0.14 155)",
  macrotask: "oklch(0.8 0.12 255.6)",
} as const;

export type TraceCardInput = {
  state: LoopState;
  code: string;
  step: number;
  total: number;
};

export type ShareOutcome = "share" | "clipboard" | "download" | "cancelled";

/* ------------------------------------------------------------------------- *
 * Pure layout helpers — unit-tested in tests/share-image.test.ts
 * ------------------------------------------------------------------------- */

/** Header label, e.g. "event loop trace — step 12 / 40". */
export function formatTraceLabel(step: number, total: number): string {
  return `event loop trace — step ${step} / ${total}`;
}

/**
 * Pick at most `max` items to draw, reserving one slot for a "+N more" row
 * when there is overflow. Returns the visible items plus the hidden count.
 */
export function planLane<T>(items: readonly T[], max: number): { items: T[]; more: number } {
  if (items.length <= max) return { items: [...items], more: 0 };
  return { items: items.slice(0, max - 1), more: items.length - (max - 1) };
}

/**
 * Window of up to SNIPPET_LINES source lines around the currently-executing
 * line (or the top of the file before the first instruction). Returns the
 * 1-based line number of the first excerpted line and the index of the
 * focused line inside `lines` (-1 when the excerpt is empty).
 */
export function snippetAround(
  code: string,
  currentLine: number | undefined,
): { startLine: number; lines: string[]; focusIndex: number } {
  const src = code.split("\n");
  if (src[src.length - 1] === "") src.pop();
  if (src.length === 0) return { startLine: 0, lines: [], focusIndex: -1 };
  const target = currentLine === undefined ? 1 : Math.min(Math.max(1, currentLine), src.length);
  let start = Math.max(0, target - 2);
  start = Math.min(start, Math.max(0, src.length - SNIPPET_LINES));
  const lines = src.slice(start, start + SNIPPET_LINES);
  const focusIndex = currentLine === undefined ? -1 : target - 1 - start;
  return { startLine: start + 1, lines, focusIndex };
}

/* ------------------------------------------------------------------------- *
 * Canvas rendering
 * ------------------------------------------------------------------------- */

type Ctx = CanvasRenderingContext2D;

function roundRectPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function truncateText(ctx: Ctx, text: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Block on the JetBrains Mono weights the card uses, so exports don't fall back. */
async function ensureFonts(): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) return;
  await document.fonts.ready;
  await Promise.all([400, 500, 700].map((w) => document.fonts.load(`${w} 16px "JetBrains Mono"`)));
}

export async function renderTraceCard(input: TraceCardInput): Promise<Blob> {
  await ensureFonts();
  // Render at device resolution and scale the context back to logical units, so
  // exports stay crisp on HiDPI/retina displays and in full-size previews.
  const dpr = Math.max(
    1,
    Math.min((typeof window !== "undefined" && window.devicePixelRatio) || 1, MAX_DPR),
  );
  const canvas = document.createElement("canvas");
  canvas.width = TRACE_CARD_WIDTH * dpr;
  canvas.height = TRACE_CARD_HEIGHT * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available in this browser");
  ctx.scale(dpr, dpr);
  drawTraceCard(ctx, input);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not encode PNG"))),
      "image/png",
    );
  });
}

function drawTraceCard(ctx: Ctx, input: TraceCardInput): void {
  const { state, code, step, total } = input;
  const W = TRACE_CARD_WIDTH;
  const H = TRACE_CARD_HEIGHT;

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle 32px devtools grid.
  ctx.strokeStyle = C.gridLine;
  ctx.globalAlpha = 0.4;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 32; x < W; x += 32) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 32; y < H; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Header: JS badge + wordmark.
  roundRectPath(ctx, 48, 40, 44, 44, 6);
  ctx.fillStyle = C.primary;
  ctx.fill();
  ctx.fillStyle = C.primaryFg;
  ctx.font = `700 20px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("JS", 70, 63);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = C.foreground;
  ctx.font = `700 34px ${FONT}`;
  const wordmarkX = 110;
  ctx.fillText("runtime", wordmarkX, 74);
  const dotX = wordmarkX + ctx.measureText("runtime").width;
  ctx.fillStyle = C.muted;
  ctx.fillText(".js", dotX, 74);

  ctx.fillStyle = C.muted;
  ctx.font = `400 16px ${FONT}`;
  ctx.fillText(formatTraceLabel(step, total), wordmarkX, 104);

  // Lanes: Call Stack / Microtask Queue / Macrotask Queue.
  const innerX = 48;
  const innerW = W - 96;
  const gap = 16;
  const colW = (innerW - gap * 2) / 3;
  const laneTop = 152;
  const laneH = 296;

  const cols: {
    x: number;
    title: string;
    hint: string;
    color: string;
    items: unknown;
    kind: "stack" | "micro" | "macro";
  }[] = [
    {
      x: innerX,
      title: "Call Stack",
      hint: "LIFO — top frame is executing",
      color: C.stack,
      items: state.stack,
      kind: "stack",
    },
    {
      x: innerX + colW + gap,
      title: "Microtask Queue",
      hint: "drains fully before the next task",
      color: C.microtask,
      items: state.microtasks,
      kind: "micro",
    },
    {
      x: innerX + (colW + gap) * 2,
      title: "Macrotask Queue",
      hint: "one task per loop turn",
      color: C.macrotask,
      items: state.macrotasks,
      kind: "macro",
    },
  ];

  for (const col of cols) {
    roundRectPath(ctx, col.x, laneTop, colW, laneH, 8);
    ctx.fillStyle = C.card;
    ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = col.color;
    ctx.font = `700 13px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    ctx.textAlign = "left";
    ctx.fillText(col.title.toUpperCase(), col.x + 16, laneTop + 30);

    ctx.fillStyle = C.muted;
    ctx.font = `400 12px ${FONT}`;
    ctx.fillText(col.hint, col.x + 16, laneTop + 52);

    const left = col.x + 16;
    const right = col.x + colW - 16;
    const itemsTop = laneTop + 70;

    if (col.kind === "stack") {
      drawStack(
        ctx,
        left,
        right,
        itemsTop,
        planLane(state.stack as StackFrame[], MAX_STACK_FRAMES),
      );
    } else {
      const queue = (col.kind === "micro" ? state.microtasks : state.macrotasks) as QueueItem[];
      drawQueue(ctx, left, right, itemsTop, col.color, planLane(queue, MAX_QUEUE_ITEMS));
    }
  }

  // Code excerpt around the executing line.
  const codeTop = 462;
  const codeH = 122;
  const excerpt = snippetAround(code, state.currentLine);

  roundRectPath(ctx, innerX, codeTop, innerW, codeH, 8);
  ctx.fillStyle = C.card;
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = C.muted;
  ctx.font = `700 11px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText(state.currentLine ? "NOW EXECUTING" : "SOURCE", innerX + 16, codeTop + 24);
  if (state.currentLine) {
    ctx.textAlign = "right";
    ctx.fillText(`line ${state.currentLine}`, innerX + innerW - 16, codeTop + 24);
    ctx.textAlign = "left";
  }

  const gutterW = 44;
  const lineH = 24;
  const textX = innerX + 16 + gutterW;
  const maxTextW = innerW - 32 - gutterW;
  // The active line spans the full inner content width (matching the live
  // CodeMirror highlight), never just the width of the rendered text.
  const codeLeft = innerX + 16;
  const codeRight = innerX + innerW - 16;
  for (let i = 0; i < excerpt.lines.length; i++) {
    const y = codeTop + 46 + i * lineH;
    if (i === excerpt.focusIndex) {
      ctx.fillStyle = "oklch(0.892 0.181 102.4 / 0.12)";
      ctx.fillRect(codeLeft, y - lineH + 3, codeRight - codeLeft, lineH - 2);
    }
    ctx.fillStyle = C.muted;
    ctx.font = `400 12px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillText(String(excerpt.startLine + i), textX - 8, y);
    ctx.textAlign = "left";
    ctx.fillStyle = i === excerpt.focusIndex ? C.foreground : C.panelFg;
    ctx.font = `400 16px ${FONT}`;
    ctx.fillText(truncateText(ctx, excerpt.lines[i] ?? " ", maxTextW), textX, y);
  }

  // Footer watermark.
  ctx.fillStyle = C.muted;
  ctx.font = `400 12px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillText("event loop visualizer", innerX, 612);
  ctx.textAlign = "right";
  ctx.fillText("runtimejs.vercel.app", innerX + innerW, 612);
}

function drawStack(
  ctx: Ctx,
  left: number,
  right: number,
  top: number,
  { items, more }: { items: StackFrame[]; more: number },
): void {
  const rowH = 26;
  items.forEach((frame, i) => {
    const executing = i === 0;
    const y = top + i * rowH;
    const h = 21;
    if (executing) {
      ctx.fillStyle = "oklch(0.892 0.181 102.4 / 0.14)";
      roundRectPath(ctx, left, y, right - left, h, 4);
      ctx.fill();
      ctx.fillStyle = C.stack;
      ctx.fillRect(left, y, 3, h);
    } else {
      ctx.fillStyle = C.accent;
      roundRectPath(ctx, left, y, right - left, h, 4);
      ctx.fill();
    }
    ctx.fillStyle = executing ? C.foreground : C.panelFg;
    ctx.font = `500 13px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const suffix = frame.line ? ` · line ${frame.line}` : "";
    const label = truncateText(ctx, frame.name + suffix, right - left - 8 - (executing ? 74 : 0));
    ctx.fillText(label, left + 8, y + h / 2 + 1);
    if (executing) {
      ctx.fillStyle = C.stack;
      ctx.font = `700 10px ${FONT}`;
      ctx.textAlign = "right";
      ctx.fillText("executing", right - 8, y + h / 2 + 1);
      ctx.textAlign = "left";
    }
  });
  if (more > 0) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 12px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(`+${more} more frames`, left + 4, top + items.length * rowH + 15);
  }
}

function drawQueue(
  ctx: Ctx,
  left: number,
  right: number,
  top: number,
  color: string,
  { items, more }: { items: QueueItem[]; more: number },
): void {
  let x = left;
  let y = top;
  const rowH = 30;
  const pad = 14;
  const maxW = right - left;
  ctx.font = `400 12.5px ${FONT}`;
  ctx.textBaseline = "middle";
  for (const item of items) {
    const text = truncateText(ctx, item.label, maxW - pad * 2);
    const w = Math.min(maxW, ctx.measureText(text).width + pad * 2);
    if (x + w > right) {
      x = left;
      y += rowH;
    }
    roundRectPath(ctx, x, y, w, 22, 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(text, x + pad, y + 12);
    x += w + 8;
  }
  if (more > 0) {
    ctx.fillStyle = C.muted;
    ctx.font = `400 12px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    const text = `+${more} more`;
    if (ctx.measureText(text).width + 8 > right - x) {
      x = left;
      y += rowH;
    }
    ctx.fillText(text, x, y + 16);
  }
}

/* ------------------------------------------------------------------------- *
 * Output
 * ------------------------------------------------------------------------- */

/**
 * Offer the PNG in order of preference: native share sheet (mobile) →
 * clipboard copy (desktop) → plain download. Feature-detects each step.
 */
export async function sharePng(blob: Blob, filename: string): Promise<ShareOutcome> {
  const file = new File([blob], filename, { type: "image/png" });

  if (typeof navigator !== "undefined" && "canShare" in navigator) {
    try {
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "runtime.js event loop trace",
        });
        return "share";
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return "cancelled";
    }
  }

  if (
    typeof ClipboardItem !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.clipboard?.write === "function"
  ) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      return "clipboard";
    } catch {
      // fall through to the download fallback
    }
  }

  if (typeof document !== "undefined") {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return "download";
}
