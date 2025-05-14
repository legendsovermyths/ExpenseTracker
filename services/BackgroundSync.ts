import { InteractionManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./Supabase";

// ------- 1. raw fetch -------------------------------------------------
async function fetchSince(since?: string) {
  // ledger_entry
  const leQuery = supabase.from("ledger_entry").select("*");

  // line_item
  const liQuery = supabase.from("line_item").select("*");

  if (since != "Never") {
    leQuery.gte("updated_at", since);
    liQuery.gte("updated_at", since);
  }

  const [leRes, liRes] = await Promise.all([leQuery, liQuery]);

  if (leRes.error) throw leRes.error;
  if (liRes.error) throw liRes.error;

  return {
    ledger: leRes.data as any[],
    items: liRes.data as any[],
  };
}

// ------- 2. single-flight background sync ----------------------------
let inFlight: Promise<string> | null = null;

export function requestSync(lastSync?: string): Promise<string> {
  // already running? ──> return same promise
  if (inFlight) return inFlight;

  // debounce multiple triggers within a tick / 1 s window
  inFlight = new Promise<string>((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      const connected = await NetInfo.fetch();
      if (!connected.isConnected) {
        inFlight = null;
        return reject(new Error("offline"));
      }

      try {
        const { ledger, items } = await fetchSince(lastSync);
        console.log(ledger, items);
        // -------- call into your Rust backend via FFI -----------
        // Replace this with actual FFI upsert helpers
        // await rustBridge.upsertLedger(ledger, items);
        //---------------------------------------------------------

        // compute newest updated_at we just saw
        const newest =
          [...ledger, ...items]
            .map((r: any) => r.updated_at)
            .sort()
            .pop() ||
          lastSync ||
          new Date().toISOString();

        resolve(newest);
      } catch (err) {
        reject(err);
      } finally {
        inFlight = null; // ready for next request
      }
    });
  });

  return inFlight;
}
