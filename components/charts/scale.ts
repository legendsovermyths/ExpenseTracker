// Pure chart maths: scales, ticks, compact ₹ labels and SVG path builders.
// Kept dependency-free and worklet-safe where marked so paths can be built
// on the UI thread during animations.

export interface Point {
  x: number;
  y: number;
}

/** Maps [d0, d1] → [r0, r1]. A zero-width domain maps to the range midpoint. */
export const linearScale = (d0: number, d1: number, r0: number, r1: number) => {
  "worklet";
  const span = d1 - d0;
  return (v: number) => {
    "worklet";
    return span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0);
  };
};

/** Evenly divides [0, width] into `count` slots; returns each slot's start and width. */
export const bandScale = (count: number, width: number, paddingRatio = 0.4) => {
  const step = count > 0 ? width / count : 0;
  const band = step * (1 - paddingRatio);
  return {
    step,
    band,
    x: (i: number) => i * step + (step - band) / 2,
    center: (i: number) => i * step + step / 2,
  };
};

/** "Nice" tick values from 0 (or min if negative) up to ≥ max, roughly `count` steps. */
export const niceTicks = (min: number, max: number, count = 3): number[] => {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return [0];
  const raw = (hi - lo) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
  const start = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  let v = start;
  do {
    ticks.push(Math.round(v * 1e6) / 1e6);
    v += step;
  } while (ticks[ticks.length - 1] < hi - 1e-9);
  return ticks;
};

const trim = (n: number) => {
  const s = n.toFixed(n >= 10 ? 0 : 1);
  return s.endsWith(".0") ? s.slice(0, -2) : s;
};

/** Compact rupee label with Indian units: 950, 1.2k, 45k, 1.1L, 2.5Cr. */
export const compactAmount = (value: number, symbol = ""): string => {
  "worklet";
  const sign = value < 0 ? "-" : "";
  const v = Math.abs(value);
  let body: string;
  if (v >= 1e7) body = trim(v / 1e7) + "Cr";
  else if (v >= 1e5) body = trim(v / 1e5) + "L";
  else if (v >= 1e3) body = trim(v / 1e3) + "k";
  else body = String(Math.round(v));
  return sign + symbol + body;
};

/**
 * Monotone cubic (Fritsch–Carlson) path through points sorted by x. Never
 * overshoots, so spend lines don't dip below zero between points.
 */
export const linePath = (pts: Point[]): string => {
  "worklet";
  const n = pts.length;
  if (n === 0) return "";
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    m.push(dx[i] === 0 ? 0 : (pts[i + 1].y - pts[i].y) / dx[i]);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0;
      t[i + 1] = 0;
      continue;
    }
    const a = t[i] / m[i];
    const b = t[i + 1] / m[i];
    const h = a * a + b * b;
    if (h > 9) {
      const k = 3 / Math.sqrt(h);
      t[i] = k * a * m[i];
      t[i + 1] = k * b * m[i];
    }
  }
  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + h * t[i]} ${pts[i + 1].x - h},${pts[i + 1].y - h * t[i + 1]} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
};

/** Closed area under a line, down to `baseY`. */
export const areaPath = (pts: Point[], baseY: number): string => {
  "worklet";
  if (pts.length === 0) return "";
  const line = linePath(pts);
  const last = pts[pts.length - 1];
  return `${line} L${last.x},${baseY} L${pts[0].x},${baseY} Z`;
};

/** Donut segment between angles (radians, 0 = 12 o'clock, clockwise). */
export const arcPath = (cx: number, cy: number, r: number, thickness: number, a0: number, a1: number): string => {
  "worklet";
  const sweep = Math.min(a1 - a0, Math.PI * 2 - 1e-4);
  if (sweep <= 0) return "";
  const end = a0 + sweep;
  const ri = r - thickness;
  const pt = (rad: number, a: number) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
  const [x0, y0] = pt(r, a0);
  const [x1, y1] = pt(r, end);
  const [x2, y2] = pt(ri, end);
  const [x3, y3] = pt(ri, a0);
  const large = sweep > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1} L${x2},${y2} A${ri},${ri} 0 ${large} 0 ${x3},${y3} Z`;
};

/** Index of the slot nearest to `x` for `count` evenly spaced points across `width`. */
export const nearestIndex = (x: number, count: number, width: number): number => {
  "worklet";
  if (count <= 1 || width <= 0) return 0;
  const i = Math.round((x / width) * (count - 1));
  return Math.max(0, Math.min(count - 1, i));
};

/** Keeps at most `max` labels, always including first and last, evenly thinned. */
export const thinLabels = (count: number, max: number): boolean[] => {
  if (count <= max) return Array(count).fill(true);
  const keep = Array(count).fill(false);
  const step = (count - 1) / (max - 1);
  for (let k = 0; k < max; k++) keep[Math.round(k * step)] = true;
  return keep;
};
