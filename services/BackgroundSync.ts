import { InteractionManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./Supabase";
import { getDirtySplitData, syncSplitData } from "./Splits";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";

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
  if (inFlight) return inFlight;

  inFlight = new Promise<string>((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const connected = await NetInfo.fetch();
        if (!connected.isConnected) {
          inFlight = null;
          return reject(new Error("offline"));
        }

        // 1) grab all the local dirty splits
        const response = await getDirtySplitData();
        console.log("dirty payload:", response);

        // 2) map to exactly the rows our Supabase tables expect:

        type LedgerInsert = Omit<
          LedgerEntryRow,
          "transaction_id" | "updated_at"
        >;
        const ledgerInserts: LedgerInsert[] = response.ledger_entries.map(
          (e) => ({
            id: e.id,
            kind: e.kind,
            description: e.description,
            created_by: e.created_by,
            total_cents: e.total_cents,
            created_at: e.created_at,
            is_deleted: e.is_deleted,
          }),
        );

        type LineItemInsert = Omit<LineItemRow, "updated_at">;
        const lineItemInserts: LineItemInsert[] = response.line_item.map(
          (i) => ({
            entry_id: i.entry_id,
            user_id: i.user_id,
            amount_cents: i.amount_cents,
            paid_cents: i.paid_cents,
            owed_cents: i.owed_cents,
          }),
        );

        // 3) push them up to Supabase:

        // insert ledger entries
        const { data: leData, error: leErr } = await supabase
          .from("ledger_entry")
          .upsert(ledgerInserts, { onConflict: "id", ignoreDuplicates: true })
          .select();
        if (leErr) throw leErr;
        console.log(leData, leErr);
        // insert line items
        const { data: liData, error: liErr } = await supabase
          .from("line_item")
          .upsert(lineItemInserts, {
            onConflict: "entry_id, user_id",
            ignoreDuplicates: true,
          });
        if (liErr) throw liErr;

        // 4) now pull down everything updated since lastSync
        const { ledger, items } = await fetchSince(lastSync);
        await syncSplitData(ledger, items);

        // figure out the newest timestamp
        const newest =
          [...ledger, ...items]
            .map((r) => r.updated_at)
            .filter((ts): ts is string => !!ts) // drop any undefined
            .sort()
            .pop() ||
          lastSync ||
          new Date().toISOString();

        resolve(newest);
      } catch (err) {
        console.log(err);
        reject(err);
      } finally {
        inFlight = null;
      }
    });
  });

  return inFlight;
}
