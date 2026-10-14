import { invokeBackend } from "./api";
import { Action } from "../types/actions/actions";
import { useExpensifyStore } from "../store/store";

const BATCH_MONTHS = 3;
const MAX_BATCHES = 40; // safety cap (~10 years)

// The store only ever eagerly holds the last 6 months of transactions
// (see App.tsx). Screens that need to look further back (a 12-month trend,
// an old picked date range, etc.) should await this first — it's a no-op
// unless the requested date is actually outside what's already loaded.
export async function ensureTransactionsLoadedFrom(targetDate: Date): Promise<void> {
  const store = useExpensifyStore.getState();
  let loadedSince = store.transactionsLoadedSince
    ? new Date(store.transactionsLoadedSince)
    : new Date();

  let batches = 0;
  while (targetDate < loadedSince && batches < MAX_BATCHES) {
    const newBoundary = new Date(
      loadedSince.getFullYear(),
      loadedSince.getMonth() - BATCH_MONTHS,
      loadedSince.getDate(),
    );

    const response = await invokeBackend(Action.GetTransactions, {
      start_date: newBoundary.toISOString(),
      end_date: loadedSince.toISOString(),
    });
    useExpensifyStore.getState().mergeTransactions(response.additions?.transactions ?? []);
    useExpensifyStore.getState().setTransactionsLoadedSince(newBoundary.toISOString());

    loadedSince = newBoundary;
    batches++;
  }
}
