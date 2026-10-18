// "Recently changed" store behind the crafted save feedback. Forms mark what
// they changed; the row (or total) showing that item consumes the mark once
// and plays its bloom / count-up. Framework-free and id-keyed, so only the
// affected row is notified — lists never re-render as a whole.

export type FeedbackKind =
  | "transaction"
  | "split"
  | "groupExpense"
  | "fundEntry"
  | "account"
  | "category"
  | "fund"
  | "group"
  | "friend";

export type Change = "added" | "edited";

const TTL_MS = 2500;

let clock: () => number = () => Date.now();
/** Test hook. */
export const __setClock = (fn: () => number) => {
  clock = fn;
};

type Listener = () => void;

const changes = new Map<string, { change: Change; at: number }>();
const changeListeners = new Map<string, Set<Listener>>();

const keyOf = (kind: FeedbackKind, id: string | number) => `${kind}:${id}`;

const notify = (map: Map<string, Set<Listener>>, key: string) => map.get(key)?.forEach((l) => l());

const subscribeTo = (map: Map<string, Set<Listener>>, key: string, fn: Listener) => {
  let set = map.get(key);
  if (!set) map.set(key, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
    if (set!.size === 0) map.delete(key);
  };
};

/** Record that items were added/edited so their rows can bloom when shown. */
export const markChanged = (kind: FeedbackKind, ids: Array<string | number>, change: Change) => {
  const at = clock();
  ids.forEach((id) => {
    const key = keyOf(kind, id);
    // An edit right after an add is still "added" from the list's point of view.
    const prev = changes.get(key);
    changes.set(key, { change: prev && at - prev.at < TTL_MS ? prev.change : change, at });
    notify(changeListeners, key);
  });
};

/** Returns the pending change for an item (once), or null if none/expired. */
export const consumeChange = (kind: FeedbackKind, id: string | number): Change | null => {
  const key = keyOf(kind, id);
  const entry = changes.get(key);
  if (!entry) return null;
  changes.delete(key);
  return clock() - entry.at <= TTL_MS ? entry.change : null;
};

export const subscribeChange = (kind: FeedbackKind, id: string | number, fn: Listener) =>
  subscribeTo(changeListeners, keyOf(kind, id), fn);

// ── Totals (spent, balance, owed…) ──────────────────────────────────

const totals = new Map<string, { delta: number; at: number }>();
const totalListeners = new Map<string, Set<Listener>>();

/** Record a change to a displayed total so it can show a delta chip. */
export const markTotalChanged = (key: string, deltaCents: number) => {
  if (!deltaCents) return;
  const at = clock();
  const prev = totals.get(key);
  totals.set(key, { delta: (prev && at - prev.at < TTL_MS ? prev.delta : 0) + deltaCents, at });
  notify(totalListeners, key);
};

export const consumeTotalChange = (key: string): number | null => {
  const entry = totals.get(key);
  if (!entry) return null;
  totals.delete(key);
  return clock() - entry.at <= TTL_MS ? entry.delta : null;
};

/**
 * Non-destructive read for chips: several places can show the same total
 * (Transactions tab, Dashboard hero). Each chip remembers the last `at` it
 * showed so it plays once per change.
 */
export const peekTotalChange = (key: string): { delta: number; at: number } | null => {
  const entry = totals.get(key);
  if (!entry || clock() - entry.at > TTL_MS) return null;
  return entry;
};

export const subscribeTotal = (key: string, fn: Listener) => subscribeTo(totalListeners, key, fn);

/** Test hook. */
export const __reset = () => {
  changes.clear();
  totals.clear();
  changeListeners.clear();
  totalListeners.clear();
};
