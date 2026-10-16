import React, { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { useExpensifyStore } from "../store/store";
import {
  applyBalanceDeltas,
  balanceImpactByFriend,
  deleteSplit,
  fetchSplitSummary,
  updateUserBalances,
} from "../services/Splits";
import { fetchGroupDetail } from "../services/Groups";
import { syncSplitsNow } from "../services/BackgroundSync";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { listAttachments } from "../services/Attachments";
import { Attachment, DOC_TYPE_LABELS } from "../types/entity/Attachment";
import {
  BottomBar,
  Button,
  DetailHero,
  ListRow,
  Page,
  RowGroup,
  SkeletonList,
  Tone,
  confirm,
  formatMoney,
  toast,
} from "../components/ui";
import SplitBreakdownCard from "../components/SplitBreakdownCard";

interface Item {
  user_id: string;
  amount_cents: number;
  paid_cents: number;
  owed_cents: number;
}

const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

const GroupExpenseSummaryScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { entryId } = route.params as { entryId: string; grpId?: string };

  const me = useExpensifyStore((s) => s.getUserId());
  const transactionsById = useExpensifyStore((s) => s.transactions);
  const categoriesById = useExpensifyStore((s) => s.categories);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const userBalancesById = useExpensifyStore((s) => s.userbalances);
  const setUserBalancesInUI = useExpensifyStore((s) => s.setUserBalances);

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<any>(null);
  const [grpId, setGrpId] = useState<string | null>(route.params?.grpId ?? null);
  const [groupName, setGroupName] = useState("");
  const [names, setNames] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<Attachment[]>([]);

  const load = async () => {
    const res = await fetchSplitSummary(entryId);
    setSummary(res);
    const gid = res.grp_id ?? grpId;
    setGrpId(gid);
    const n: Record<string, string> = {};
    Object.values(userBalancesById).forEach((b) => (n[b.id] = b.name));
    if (gid) {
      try {
        const d = await fetchGroupDetail(gid, me);
        setGroupName(d.group.name);
        d.members.forEach((m) => {
          if (m.user_name) n[m.user_id] = m.user_name;
        });
      } catch {
        // group not synced yet — fall back to balance names
      }
    }
    setNames(n);
    if (res.transaction_id && res.created_at) {
      await ensureTransactionsLoadedFrom(new Date(res.created_at));
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      load();
      listAttachments("SPLIT", entryId)
        .then(setFiles)
        .catch(() => setFiles([]));
    }, [entryId]),
  );

  if (loading || !summary) {
    return (
      <Page title="Expense">
        <SkeletonList rows={4} />
      </Page>
    );
  }

  const items: Item[] = (summary.items ?? []).filter(
    (i: Item) => i.paid_cents !== 0 || i.owed_cents !== 0,
  );
  const nameOf = (id: string) => (id === me ? "You" : names[id] || "Someone");
  const myItem = items.find((i) => i.user_id === me);
  const myPaid = myItem?.paid_cents ?? 0;
  const myOwe = myItem?.owed_cents ?? 0;
  const myNet = myPaid - myOwe;
  const isPayment = summary.kind === "PAYMENT";
  const canEdit = !isPayment && !!grpId;
  const totalCents: number =
    summary.total_cents ?? items.reduce((s, i) => s + i.paid_cents, 0);

  const txn = summary.transaction_id ? transactionsById[String(summary.transaction_id)] : null;
  const category = txn ? categoriesById[String(txn.subcategory_id || txn.category_id)] : null;
  const linkedAccount = txn ? accountsById[String(txn.account_id)] : null;
  const glyphColor = category
    ? colorForId(txn!.subcategory_id || txn!.category_id || 0, COLORS.ordinal)
    : COLORS.accent;

  const dateLabel = summary.created_at
    ? new Date(summary.created_at).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  const subtitleParts = [groupName ? `in ${groupName}` : null, dateLabel, category?.name].filter(
    Boolean,
  );

  // You first, then everyone else in the order the server returned them.
  const people = [...items]
    .sort((a, b) => (a.user_id === me ? -1 : b.user_id === me ? 1 : 0))
    .map((i) => ({
      id: i.user_id,
      name: nameOf(i.user_id),
      paidCents: i.paid_cents,
      oweCents: i.owed_cents,
    }));

  let headlineLabel: string;
  let headlineTone: Tone;
  let headlineAmount: number | null;
  if (isPayment) {
    const payer = items.find((i) => i.paid_cents > 0);
    headlineLabel = payer ? `${nameOf(payer.user_id)} paid` : "Payment";
    headlineTone = "muted";
    headlineAmount = totalCents;
  } else if (!myItem) {
    headlineLabel = "You're not part of this expense";
    headlineTone = "muted";
    headlineAmount = null;
  } else if (myNet > 0) {
    headlineLabel = "You lent";
    headlineTone = "down";
    headlineAmount = myNet;
  } else if (myNet < 0) {
    headlineLabel = "You borrowed";
    headlineTone = "up";
    headlineAmount = Math.abs(myNet);
  } else {
    headlineLabel = "You paid your share";
    headlineTone = "muted";
    headlineAmount = null;
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this expense?",
      message: "It will be removed for everyone in the group.",
    });
    if (!ok) return;
    try {
      await deleteSplit(entryId);
      const impact = balanceImpactByFriend(summary.items ?? [], me);
      const deltas: Record<string, number> = {};
      Object.entries(impact).forEach(([id, v]) => (deltas[id] = -v));
      const balances = applyBalanceDeltas(userBalancesById, deltas, names);
      await updateUserBalances(balances);
      setUserBalancesInUI(balances);
      syncSplitsNow().catch(() => {});
      toast("Expense deleted");
      navigation.goBack();
    } catch (e) {
      console.log("Delete group expense error:", e);
      toast("Couldn't delete the expense", "error");
    }
  };

  const goToTransaction = () => {
    if (txn) {
      navigation.navigate("TransactionEdit", { transaction: txn, mode: "edit" });
    } else {
      navigation.navigate("TransactionEdit", {
        transaction: {
          description: summary.description,
          amount: myOwe / 100,
          date_time: summary.created_at || new Date().toISOString(),
        },
        mode: "add",
        entryId,
      });
    }
  };

  const title: string = summary.description || (isPayment ? "Payment" : "Expense");
  const showLinked = !isPayment && myOwe > 0;
  const fileTypes = Array.from(
    new Set(files.map((f) => (f.doc_type ? DOC_TYPE_LABELS[f.doc_type] : "Unsorted"))),
  ).join("  ·  ");

  return (
    <Page
      title={title}
      hero={
        <DetailHero
          icon={category ? category.icon_name : isPayment ? "cash-fast" : "account-group"}
          iconType={category ? category.icon_type : "material-community"}
          iconColor={glyphColor}
          title={title}
          meta={subtitleParts.join("  ·  ")}
          label={headlineLabel}
          amountCents={headlineAmount}
          amountTone={headlineTone}
          caption={isPayment ? undefined : `of ${formatMoney(totalCents)} total  ·  ${people.length} people`}
        />
      }
      footer={
        <BottomBar>
          {canEdit && (
            <Button
              title="Edit expense"
              icon="pencil-outline"
              onPress={() => navigation.navigate("AddGroupExpense", { grpId, entryId })}
            />
          )}
          <Button title="Delete expense" variant="destructive" onPress={handleDelete} />
        </BottomBar>
      }
    >
      <SplitBreakdownCard people={people} showBar={!isPayment} />

      {(showLinked || files.length > 0) && (
        <RowGroup inset={SPACE.lg + 34 + SPACE.md} style={styles.links}>
          {showLinked && (
            <ListRow
              icon={txn ? "receipt-text-outline" : "plus-circle-outline"}
              iconColor={txn ? COLORS.accent : COLORS.inkMuted}
              title={txn ? "Logged as expense" : "Add as expense"}
              subtitle={
                txn
                  ? `${linkedAccount?.name ?? "Account"}  ·  ${formatMoney(Math.round(txn.amount * 100))}`
                  : "Track your share in your spending"
              }
              chevron
              onPress={goToTransaction}
            />
          )}
          {files.length > 0 && (
            <ListRow
              icon="paperclip"
              title={`${files.length} ${files.length === 1 ? "file" : "files"} attached`}
              subtitle={fileTypes}
              chevron
              onPress={() => navigation.navigate("AttachmentViewer", { attachments: files, index: 0 })}
            />
          )}
        </RowGroup>
      )}
    </Page>
  );
};

const styles = StyleSheet.create({
  links: { marginTop: SPACE.sm },
});

export default GroupExpenseSummaryScreen;
