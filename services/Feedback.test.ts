import {
  __reset,
  __setClock,
  consumeChange,
  consumeTotalChange,
  markChanged,
  markTotalChanged,
  peekTotalChange,
  subscribeChange,
} from "./Feedback";

let now = 1000;
beforeEach(() => {
  __reset();
  now = 1000;
  __setClock(() => now);
});

describe("row changes", () => {
  it("is consumed exactly once", () => {
    markChanged("transaction", [7], "edited");
    expect(consumeChange("transaction", 7)).toBe("edited");
    expect(consumeChange("transaction", 7)).toBeNull();
  });

  it("expires after the TTL", () => {
    markChanged("transaction", [7], "added");
    now += 3000;
    expect(consumeChange("transaction", 7)).toBeNull();
  });

  it("keeps 'added' when the same item is edited right after", () => {
    markChanged("split", ["a"], "added");
    markChanged("split", ["a"], "edited");
    expect(consumeChange("split", "a")).toBe("added");
  });

  it("is scoped by kind", () => {
    markChanged("transaction", [1], "added");
    expect(consumeChange("fundEntry", 1)).toBeNull();
    expect(consumeChange("transaction", 1)).toBe("added");
  });

  it("notifies only the matching row", () => {
    const hit = jest.fn();
    const miss = jest.fn();
    subscribeChange("transaction", 1, hit);
    subscribeChange("transaction", 2, miss);
    markChanged("transaction", [1], "edited");
    expect(hit).toHaveBeenCalledTimes(1);
    expect(miss).not.toHaveBeenCalled();
  });

  it("unsubscribes cleanly", () => {
    const fn = jest.fn();
    const off = subscribeChange("transaction", 1, fn);
    off();
    markChanged("transaction", [1], "edited");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("totals", () => {
  it("accumulates deltas within the window", () => {
    markTotalChanged("spent", 4200);
    markTotalChanged("spent", 800);
    expect(consumeTotalChange("spent")).toBe(5000);
    expect(consumeTotalChange("spent")).toBeNull();
  });

  it("lets several chips peek the same change", () => {
    markTotalChanged("spent", 1500);
    expect(peekTotalChange("spent")?.delta).toBe(1500);
    expect(peekTotalChange("spent")?.delta).toBe(1500);
    now += 3000;
    expect(peekTotalChange("spent")).toBeNull();
  });

  it("ignores zero deltas", () => {
    markTotalChanged("spent", 0);
    expect(consumeTotalChange("spent")).toBeNull();
  });
});
