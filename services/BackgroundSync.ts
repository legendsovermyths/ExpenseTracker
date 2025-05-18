import { InteractionManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./Supabase";
import { syncSplitData } from "./Splits";

// ------- 1. raw fetch -------------------------------------------------
async function fetchSince(since?: string) {
  // ledger_entry
  const leQuery = supabase.from("ledger_entry").select("*");

  // line_item
  const liQuery = supabase.from("line_item").select("*");
  console.log("SINCE", since); 
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
  if (inFlight) return inFlight;

  inFlight = new Promise<string>((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      const connected = await NetInfo.fetch();
      if (!connected.isConnected) {
        inFlight = null;
        return reject(new Error("offline"));
      }

      try {
        const { ledger, items } = await fetchSince(lastSync);
        console.log("LEDGER ITEMSSSSS",ledger, items);
        await syncSplitData(ledger, items);
        const newest =
          [...ledger, ...items]
            .map((r: any) => r.updated_at)
            .sort()
            .pop() ||
          lastSync ||
          new Date().toISOString();

        resolve(newest);
      } catch (err) {
        console.log("ERROR", err);
      } finally {
        inFlight = null; // ready for next request
      }
    });
  });

  return inFlight;
}
