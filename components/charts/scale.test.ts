import {
  arcPath,
  bandScale,
  compactAmount,
  linePath,
  linearScale,
  nearestIndex,
  niceTicks,
  thinLabels,
} from "./scale";

describe("linearScale", () => {
  it("maps domain to range, including inverted y ranges", () => {
    const y = linearScale(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(50)).toBe(100);
    expect(y(100)).toBe(0);
  });
  it("handles a zero-width domain", () => {
    expect(linearScale(5, 5, 0, 100)(5)).toBe(50);
  });
});

describe("niceTicks", () => {
  it("starts at zero and covers the max with round steps", () => {
    expect(niceTicks(0, 2400, 3)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(0, 87, 3)).toEqual([0, 50, 100]);
  });
  it("handles all-zero data", () => {
    expect(niceTicks(0, 0)).toEqual([0]);
  });
  it("includes negatives", () => {
    const t = niceTicks(-50, 120, 3);
    expect(t[0]).toBeLessThanOrEqual(-50);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(120);
  });
});

describe("compactAmount", () => {
  it("uses Indian units", () => {
    expect(compactAmount(950)).toBe("950");
    expect(compactAmount(1200)).toBe("1.2k");
    expect(compactAmount(45000)).toBe("45k");
    expect(compactAmount(110000)).toBe("1.1L");
    expect(compactAmount(25000000, "₹")).toBe("₹2.5Cr");
    expect(compactAmount(-2000)).toBe("-2k");
  });

  it("uses western units when asked", () => {
    expect(compactAmount(950, "$", "western")).toBe("$950");
    expect(compactAmount(110000, "$", "western")).toBe("$110k");
    expect(compactAmount(25000000, "€", "western")).toBe("€25M");
    expect(compactAmount(1.2e9, "", "western")).toBe("1.2B");
  });
});

describe("linePath", () => {
  it("handles 0, 1 and many points", () => {
    expect(linePath([])).toBe("");
    expect(linePath([{ x: 1, y: 2 }])).toBe("M1,2");
    const d = linePath([
      { x: 0, y: 10 },
      { x: 10, y: 0 },
      { x: 20, y: 10 },
    ]);
    expect(d.startsWith("M0,10")).toBe(true);
    expect(d.match(/C/g)).toHaveLength(2);
  });
  it("never overshoots between equal points (monotone)", () => {
    const d = linePath([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 0 },
    ]);
    const ys = d.match(/-?\d+(\.\d+)?,(-?\d+(\.\d+)?)/g)!.map((p) => Number(p.split(",")[1]));
    expect(Math.max(...ys)).toBeLessThanOrEqual(50);
  });
});

describe("bandScale / nearestIndex / thinLabels", () => {
  it("lays out bands", () => {
    const b = bandScale(4, 100, 0.5);
    expect(b.step).toBe(25);
    expect(b.band).toBe(12.5);
    expect(b.center(0)).toBe(12.5);
  });
  it("finds the nearest point", () => {
    expect(nearestIndex(0, 5, 100)).toBe(0);
    expect(nearestIndex(49, 5, 100)).toBe(2);
    expect(nearestIndex(500, 5, 100)).toBe(4);
  });
  it("thins labels keeping ends", () => {
    const k = thinLabels(31, 6);
    expect(k[0] && k[30]).toBe(true);
    expect(k.filter(Boolean)).toHaveLength(6);
  });
});

describe("arcPath", () => {
  it("draws an arc segment and skips empty ones", () => {
    expect(arcPath(50, 50, 40, 10, 0, 0)).toBe("");
    expect(arcPath(50, 50, 40, 10, 0, Math.PI / 2).startsWith("M50,10")).toBe(true);
  });
});
