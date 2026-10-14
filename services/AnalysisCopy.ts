// ──────────────────────────────────────────────────────────────────────
// Range-agnostic copy + comparison helpers for the Analysis screen.
//
// Every helper here is shape-aware: it inspects (start, end) and emits
// the right wording. The comparison window is *always* the same-length
// immediately-prior period — no "vs last month" branching.
// ──────────────────────────────────────────────────────────────────────

const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export type RangeShape =
  | { kind: "calendarMonth"; monthName: string; monthShort: string; year: number }
  | { kind: "lastNDays"; n: number }
  | { kind: "custom"; startLabel: string; endLabel: string; days: number };

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

export const daysBetween = (start: Date, end: Date): number => {
  const ms = startOfDay(end).getTime() - startOfDay(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24)) + 1;
};

const isCalendarMonth = (start: Date, end: Date): boolean => {
  if (start.getFullYear() !== end.getFullYear()) return false;
  if (start.getMonth() !== end.getMonth()) return false;
  if (start.getDate() !== 1) return false;
  const lastDayOfMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  return end.getDate() === lastDayOfMonth;
};

const isLastNDays = (start: Date, end: Date): { n: number } | null => {
  const today = startOfDay(new Date());
  if (startOfDay(end).getTime() !== today.getTime()) return null;
  const n = daysBetween(start, end);
  // Treat 7 / 30 / 90 / 180 / 365 as recognizable "last N days" buckets.
  if ([7, 14, 28, 30, 60, 90, 180, 365].includes(n)) return { n };
  return null;
};

export const rangeShape = (start: Date, end: Date): RangeShape => {
  if (isCalendarMonth(start, end)) {
    return {
      kind: "calendarMonth",
      monthName: MONTHS_LONG[start.getMonth()],
      monthShort: MONTHS_SHORT[start.getMonth()],
      year: start.getFullYear(),
    };
  }
  const lastN = isLastNDays(start, end);
  if (lastN) return { kind: "lastNDays", n: lastN.n };
  return {
    kind: "custom",
    startLabel: `${MONTHS_SHORT[start.getMonth()]} ${start.getDate()}`,
    endLabel: `${MONTHS_SHORT[end.getMonth()]} ${end.getDate()}`,
    days: daysBetween(start, end),
  };
};

// Same-length window immediately before (start, end).
// e.g. [May 1, May 31] (31 days) → [Mar 31, Apr 30] (31 days)
export const priorWindow = (
  start: Date, end: Date,
): { priorStart: Date; priorEnd: Date } => {
  const days = daysBetween(start, end);
  const priorEnd = new Date(start);
  priorEnd.setDate(priorEnd.getDate() - 1);
  const priorStart = new Date(priorEnd);
  priorStart.setDate(priorStart.getDate() - (days - 1));
  return { priorStart: startOfDay(priorStart), priorEnd: startOfDay(priorEnd) };
};

// Human label for the comparison period — appears in the headline sentence
// and inside "what changed" insights so they read consistently.
export const priorPhrase = (shape: RangeShape): string => {
  switch (shape.kind) {
    case "calendarMonth": {
      const prevIdx = (MONTHS_LONG.indexOf(shape.monthName) + 11) % 12;
      return MONTHS_LONG[prevIdx];
    }
    case "lastNDays":
      return `the prior ${shape.n} days`;
    case "custom":
      return `the previous ${shape.days} days`;
  }
};

// Returns the segments of the headline sentence so the caller can render
// them with mixed styling (bold numbers, regular prose). No JSX in this
// file — keeps it pure TS and easy to test.
export interface HeadlineSegment {
  text: string;
  emphasis?: boolean;   // bold / numeric
  tone?: "neutral" | "up" | "down"; // colors the delta phrase
}

export const formatAmount = (n: number): string => {
  // Indian number formatting (1,23,456) without currency symbol.
  return Math.round(n).toLocaleString("en-IN");
};

export const headlineSegments = (
  shape: RangeShape,
  totalSpent: number,
  priorSpent: number,
): HeadlineSegment[] => {
  const spentSeg: HeadlineSegment = {
    text: `₹${formatAmount(totalSpent)}`,
    emphasis: true,
  };

  let deltaSeg: HeadlineSegment | null = null;
  if (priorSpent > 0) {
    const pct = Math.round(((totalSpent - priorSpent) / priorSpent) * 100);
    if (Math.abs(pct) >= 1) {
      deltaSeg = {
        text: `${Math.abs(pct)}% ${pct > 0 ? "more" : "less"}`,
        emphasis: true,
        tone: pct > 0 ? "up" : "down",
      };
    }
  }

  switch (shape.kind) {
    case "calendarMonth": {
      const seg: HeadlineSegment[] = [
        { text: "In " },
        { text: shape.monthName, emphasis: true },
        { text: ", you spent " },
        spentSeg,
      ];
      if (deltaSeg) {
        seg.push({ text: " — " }, deltaSeg, { text: ` than ${priorPhrase(shape)}.` });
      } else {
        seg.push({ text: "." });
      }
      return seg;
    }
    case "lastNDays": {
      const seg: HeadlineSegment[] = [
        { text: "Last " },
        { text: `${shape.n} days`, emphasis: true },
        { text: ": " },
        spentSeg,
        { text: " spent" },
      ];
      if (deltaSeg) {
        seg.push({ text: " — " }, deltaSeg, { text: ` than ${priorPhrase(shape)}.` });
      } else {
        seg.push({ text: "." });
      }
      return seg;
    }
    case "custom": {
      const seg: HeadlineSegment[] = [
        { text: `${shape.startLabel} → ${shape.endLabel}`, emphasis: true },
        { text: " · " },
        spentSeg,
      ];
      if (deltaSeg) {
        seg.push({ text: " — " }, deltaSeg, { text: ` than ${priorPhrase(shape)}.` });
      } else {
        seg.push({ text: "." });
      }
      return seg;
    }
  }
};

// Compact two-line headline pieces.
//   amount  →  "₹12,420"
//   period  →  "May" / "Last 90 days" / "May 3 → Jun 14"
//   delta   →  { text: "↑ 128%", suffix: "vs April", tone: 'up' } | null
export interface CompactHeadline {
  amount: string;
  period: string;
  delta: { text: string; suffix: string; tone: "up" | "down" } | null;
}

export const compactHeadline = (
  shape: RangeShape,
  totalSpent: number,
  priorSpent: number,
): CompactHeadline => {
  const amount = `₹${formatAmount(totalSpent)}`;

  let period: string;
  let priorWord: string;
  switch (shape.kind) {
    case "calendarMonth":
      period = shape.monthShort;
      priorWord = priorPhrase(shape); // e.g. "April"
      break;
    case "lastNDays":
      period = `Last ${shape.n} days`;
      priorWord = "prior";
      break;
    case "custom":
      period = `${shape.startLabel} → ${shape.endLabel}`;
      priorWord = "prior";
      break;
  }

  let delta: CompactHeadline["delta"] = null;
  if (priorSpent > 0) {
    const pct = Math.round(((totalSpent - priorSpent) / priorSpent) * 100);
    if (Math.abs(pct) >= 1) {
      delta = {
        text: `${pct > 0 ? "↑" : "↓"} ${Math.abs(pct)}%`,
        suffix: `vs ${priorWord}`,
        tone: pct > 0 ? "up" : "down",
      };
    }
  }
  return { amount, period, delta };
};

// Convenience: a single rangeLabel string for chips / titles.
export const rangeLabel = (shape: RangeShape): string => {
  switch (shape.kind) {
    case "calendarMonth":
      return `${shape.monthName} ${shape.year}`;
    case "lastNDays":
      return `Last ${shape.n} days`;
    case "custom":
      return `${shape.startLabel} → ${shape.endLabel}`;
  }
};
