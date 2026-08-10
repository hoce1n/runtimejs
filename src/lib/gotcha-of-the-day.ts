import { INTERVIEW_PATTERNS, type InterviewPattern } from "./interview-patterns";

const MS_PER_DAY = 86_400_000;

/**
 * Deterministic "gotcha of the day" pick: a pure function of the date that
 * cycles through INTERVIEW_PATTERNS one entry per calendar day, so the same
 * local calendar date always yields the same pattern. No `Math.random`, no
 * per-visit state — server-rendered and client-rendered output agree for any
 * given date.
 */
export function gotchaIndexForDate(date: Date): number {
  const day = Math.floor(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY,
  );
  const count = INTERVIEW_PATTERNS.length;
  return ((day % count) + count) % count;
}

/** The pattern selected for the given date. */
export function gotchaForDate(date: Date): InterviewPattern {
  return INTERVIEW_PATTERNS[gotchaIndexForDate(date)]!;
}
