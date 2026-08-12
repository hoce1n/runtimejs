import { describe, expect, test } from "bun:test";
import { formatTraceLabel, planLane, snippetAround } from "../src/lib/share-image";

describe("formatTraceLabel", () => {
  test("renders step and total", () => {
    expect(formatTraceLabel(12, 40)).toBe("event loop trace — step 12 / 40");
  });

  test("handles the starting and ending steps", () => {
    expect(formatTraceLabel(0, 0)).toBe("event loop trace — step 0 / 0");
    expect(formatTraceLabel(40, 40)).toBe("event loop trace — step 40 / 40");
  });
});

describe("planLane", () => {
  test("keeps everything when under the cap", () => {
    const items = [1, 2, 3];
    expect(planLane(items, 8)).toEqual({ items, more: 0 });
  });

  test("reserves one slot for the more-indicator when overflowing", () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    const { items: visible, more } = planLane(items, 8);
    expect(more).toBe(3);
    expect(visible).toHaveLength(7);
    expect(visible).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  test("exact fit keeps everything and reports no overflow", () => {
    const items = Array.from({ length: 8 }, (_, i) => i);
    expect(planLane(items, 8).more).toBe(0);
  });

  test("empty lane", () => {
    expect(planLane<number>([], 8)).toEqual({ items: [], more: 0 });
  });
});

describe("snippetAround", () => {
  test("windows around the current line with the focus in the window", () => {
    const code = Array.from({ length: 20 }, (_, i) => `const v${i} = ${i};`).join("\n");
    const s = snippetAround(code, 10);
    expect(s.startLine).toBe(9);
    expect(s.lines).toHaveLength(4);
    expect(s.focusIndex).toBe(1);
    expect(s.lines[1]).toBe("const v9 = 9;");
  });

  test("clamps to the top of the file for early lines", () => {
    const code = Array.from({ length: 20 }, (_, i) => `const v${i} = ${i};`).join("\n");
    const s = snippetAround(code, 1);
    expect(s.startLine).toBe(1);
    expect(s.lines).toHaveLength(4);
    expect(s.focusIndex).toBe(0);
  });

  test("clamps to the bottom of the file for the last lines", () => {
    const code = Array.from({ length: 6 }, (_, i) => `const v${i} = ${i};`).join("\n");
    const s = snippetAround(code, 6);
    expect(s.startLine).toBe(3);
    expect(s.lines).toHaveLength(4);
    expect(s.focusIndex).toBe(3);
    expect(s.lines[3]).toBe("const v5 = 5;");
  });

  test("renders the top of the file without a focus when no current line is known", () => {
    const code = "a();\nb();\nc();\n";
    const s = snippetAround(code, undefined);
    expect(s.startLine).toBe(1);
    expect(s.focusIndex).toBe(-1);
    expect(s.lines).toEqual(["a();", "b();", "c();"]);
  });

  test("highlights a line only when a current line is known", () => {
    const code = "a();\nb();\nc();\nd();\ne();\nf();";
    expect(snippetAround(code, undefined).focusIndex).toBe(-1);
    const withLine = snippetAround(code, 3);
    expect(withLine.focusIndex).not.toBe(-1);
    expect(withLine.lines[withLine.focusIndex]).toBe("c();");
  });

  test("clamps an out-of-range current line", () => {
    const code = "a();\nb();\n";
    const s = snippetAround(code, 99);
    expect(s.startLine).toBe(1);
    expect(s.lines).toHaveLength(2);
    expect(s.focusIndex).toBe(1);
  });

  test("returns an empty excerpt for empty source", () => {
    expect(snippetAround("", 1)).toEqual({ startLine: 0, lines: [], focusIndex: -1 });
  });
});
