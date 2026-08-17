import { InteractionManager } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { supabase } from "./Supabase";
import { getDirtySplitData, syncSplitData } from "./Splits";
import { getDirtyFundData, syncFundData } from "./Funds";
import { LedgerEntryRow } from "../types/entity/LedgerEntryRow";
import { LineItemRow } from "../types/entity/LineItemRow";
import { Fund } from "../types/entity/Fund";
import { FundEntry } from "../types/entity/FundEntry";

// ------- 1. raw fetch -------------------------------------------------
async function fetchSince(since?: string) {
  const leQuery = supabase.from("ledger_entry").select("*");
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

        const response = await getDirtySplitData();


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
        
        const { data: leData, error: leErr } = await supabase
          .from("ledger_entry")
          .upsert(ledgerInserts, { onConflict: "id" })
          .select();
        if (leErr) throw leErr;
        const { data: liData, error: liErr } = await supabase
          .from("line_item")
          .upsert(lineItemInserts, {
            onConflict: "entry_id, user_id",
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
        reject(err);
      } finally {
        inFlight = null;
      }
    });
  });

  return inFlight;
}

// ------- Fund sync — deliberately a sibling, not folded into the split
// flow above. Fund and Splits are logically independent; sharing one
// in-flight promise would mean a Fund-sync failure blocks/slows the
// already-shipped Splits path (and vice versa). Same push/pull shape,
// own single-flight guard, own checkpoint (`lastFundSync`). -------------

async function fetchFundsSince(since?: string) {
  const fundQuery = supabase.from("fund").select("*");
  const entryQuery = supabase.from("fund_entry").select("*");
  if (since != "Never") {
    fundQuery.gte("updated_at", since);
    entryQuery.gte("updated_at", since);
  }
  const [fundRes, entryRes] = await Promise.all([fundQuery, entryQuery]);

  if (fundRes.error) throw fundRes.error;
  if (entryRes.error) throw entryRes.error;

  return {
    funds: fundRes.data as any[],
    entries: entryRes.data as any[],
  };
}

let inFlightFund: Promise<string> | null = null;

export function requestFundSync(lastSync?: string): Promise<string> {
  if (inFlightFund) return inFlightFund;

  inFlightFund = new Promise<string>((resolve, reject) => {
    InteractionManager.runAfterInteractions(async () => {
      try {
        const connected = await NetInfo.fetch();
        if (!connected.isConnected) {
          inFlightFund = null;
          return reject(new Error("offline"));
        }

        const dirty = await getDirtyFundData();

        type FundInsert = Omit<Fund, "updated_at">;
        const fundInserts: FundInsert[] = dirty.funds.map((f) => ({
          id: f.id,
          name: f.name,
          icon_name: f.icon_name,
          icon_type: f.icon_type,
          is_shared: f.is_shared,
          owner_id: f.owner_id,
          other_participant_id: f.other_participant_id,
          other_participant_name: f.other_participant_name,
          target_cents: f.target_cents,
          target_date: f.target_date,
          created_at: f.created_at,
          is_deleted: f.is_deleted,
        }));

        type FundEntryInsert = Omit<FundEntry, "updated_at">;
        const entryInserts: FundEntryInsert[] = dirty.entries.map((e) => ({
          id: e.id,
          fund_id: e.fund_id,
          contributor_id: e.contributor_id,
          amount_cents: e.amount_cents,
          direction: e.direction,
          note: e.note,
          linked_transaction_id: e.linked_transaction_id,
          created_at: e.created_at,
          is_deleted: e.is_deleted,
        }));

        if (fundInserts.length > 0) {
          const { error: fundErr } = await supabase
            .from("fund")
            .upsert(fundInserts, { onConflict: "id" });
          if (fundErr) throw fundErr;
        }
        if (entryInserts.length > 0) {
          const { error: entryErr } = await supabase
            .from("fund_entry")
            .upsert(entryInserts, { onConflict: "id" });
          if (entryErr) throw entryErr;
        }

        const { funds, entries } = await fetchFundsSince(lastSync);
        await syncFundData(funds, entries);

        const newest =
          [...funds, ...entries]
            .map((r) => r.updated_at)
            .filter((ts): ts is string => !!ts)
            .sort()
            .pop() ||
          lastSync ||
          new Date().toISOString();

        resolve(newest);
      } catch (err) {
        reject(err);
      } finally {
        inFlightFund = null;
      }
    });
  });

  return inFlightFund;
}
