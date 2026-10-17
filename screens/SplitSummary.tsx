import React, { useCallback, useState } from "react";
import { StyleSheet } from "react-native";
import {
  useRoute,
  useNavigation,
  useFocusEffect,
} from "@react-navigation/native";
import { SPACE } from "../constants";
import { useExpensifyStore } from "../store/store";
import { ensureTransactionsLoadedFrom } from "../services/TransactionWindow";
import { Transaction } from "../types/entity/Transaction";
import {
  deleteSplit,
  updateUserBalances,
  fetchSplitSummary,
} from "../services/Splits";
import { formatAmountWithCommas } from "../services/Utils";
import { listAttachments } from "../services/Attachments";
import { Attachment, DOC_TYPE_LABELS } from "../types/entity/Attachment";
import { useTheme } from "../contexts/ThemeContext";
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
  toast,
  haptic,
} from "../components/ui";
import SplitBreakdownCard from "../components/SplitBreakdownCard";
import { markTotalChanged } from "../services/Feedback";

interface Params {
  entryId: string;
  friendId: string;
  friendName: string;
}

interface LineItemInfo {
  user_id: string;
  amount_cents: number;
  paid_cents: number;
  owed_cents: number;
}

const colorForId = (id: number, palette: readonly string[]): string =>
  palette[Math.abs(id) % palette.length];

const fmt = (cents: number) => `₹${formatAmountWithCommas(cents / 100, true)}`;

const SplitSummaryScreen: React.FC = () => {
  const { COLORS } = useTheme();
  const navigation: any = useNavigation();
  const route = useRoute<any>();
  const { entryId, friendName, friendId } = route.params as Params;

  const meId = useExpensifyStore((state) => state.getUserId());
  const transactionsById = useExpensifyStore((state) => state.transactions);
  const categoriesById = useExpensifyStore((state) => state.categories);
  const accountsById = useExpensifyStore((state) => state.accounts);
  const userBalancesById = useExpensifyStore((state) => state.userbalances);
  const setUserBalancesInUI = useExpensifyStore(
    (state) => state.setUserBalances,
  );

  const [loading, setLoading] = useState(true);
  const [description, setDescription] = useState<string>("Split");
  const [items, setItems] = useState<LineItemInfo[]>([]);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [kind, setKind] = useState<string>("SPLIT");
  const [transactionId, setTransactionId] = useState<number | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);

  const load = async () => {
    const res = await fetchSplitSummary(entryId);
    setDescription(res.description || "Split");
    setItems(res.items as LineItemInfo[]);
    setCreatedAt(res.created_at ?? null);
    setKind(res.kind ?? "SPLIT");
    setTransactionId(res.transaction_id ?? null);
    // The linked transaction can be older than the 6-month hot window —
    // pull in older batches so it resolves below instead of showing blank.
    if (res.transaction_id && res.created_at) {
      await ensureTransactionsLoadedFrom(new Date(res.created_at));
    }
    setLoading(false);
  };

  // Resolve the linked transaction from the live store during render so it
  // reflects a just-added expense the moment we refocus this screen.
  const transaction: Transaction | null =
    transactionId != null
      ? (transactionsById[String(transactionId)] ?? null)
      : null;

  useFocusEffect(
    useCallback(() => {
      load();
      listAttachments("SPLIT", entryId)
        .then(setFiles)
        .catch(() => setFiles([]));
    }, [entryId]),
  );

  // ── derived ────────────────────────────────────────────────────────
  const meItem = items.find((i) => i.user_id === meId);
  const friendItem = items.find((i) => i.user_id === friendId);

  const myPaid = meItem?.paid_cents ?? 0;
  const myOwe = meItem?.owed_cents ?? 0;
  const friendPaid = friendItem?.paid_cents ?? 0;
  const friendOwe = friendItem?.owed_cents ?? 0;
  const totalCents = myPaid + friendPaid;

  // my net for this entry: +ve → friend owes me, -ve → I owe friend
  const myNet = myPaid - myOwe;
  const isPayment = kind === "PAYMENT";

  // category / icon from the linked transaction, else a split glyph
  const linkedCategory = transaction
    ? categoriesById[
        String(transaction.subcategory_id || transaction.category_id)
      ]
    : null;
  const linkedAccount = transaction
    ? accountsById[String(transaction.account_id)]
    : null;
  const glyphColor = linkedCategory
    ? colorForId(
        transaction!.subcategory_id || transaction!.category_id || 0,
        COLORS.ordinal,
      )
    : COLORS.accent;

  const dateLabel = createdAt
    ? new Date(createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "";
  const subtitleParts = [dateLabel, linkedCategory?.name].filter(Boolean);

  // settlement headline
  let headlineLabel: string;
  let headlineTone: Tone;
  if (isPayment) {
    headlineLabel =
      myPaid > 0 ? `You paid ${friendName}` : `${friendName} paid you`;
    headlineTone = "muted";
  } else if (myNet > 0) {
    headlineLabel = `${friendName} owes you`;
    headlineTone = "down";
  } else if (myNet < 0) {
    headlineLabel = `You owe ${friendName}`;
    headlineTone = "up";
  } else {
    headlineLabel = "All settled";
    headlineTone = "muted";
  }
  const headlineAmount = isPayment ? totalCents : Math.abs(myNet);

  // ── delete ─────────────────────────────────────────────────────────
  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete this split?",
      message: `It will be removed for you and ${friendName}.`,
    });
    if (!ok) return;
    try {
      await deleteSplit(entryId);
      // reverse the friend's balance using the items we already have
      const balances = { ...userBalancesById };
      items.forEach((item) => {
        if (item.user_id !== meId && balances[item.user_id]) {
          const impact = item.owed_cents - item.paid_cents;
          balances[item.user_id] = {
            ...balances[item.user_id],
            net_cents: balances[item.user_id].net_cents - impact,
          };
        }
      });
      await updateUserBalances(Object.values(balances));
      setUserBalancesInUI(Object.values(balances));
      const friendItem = items.find((i) => i.user_id === friendId);
      if (friendItem)
        markTotalChanged(
          `friend:${friendId}`,
          friendItem.paid_cents - friendItem.owed_cents,
        );
      haptic("light");
      navigation.goBack();
    } catch {
      toast("Couldn't delete the split", "error");
    }
  };

  const handleEdit = () => {
    navigation.navigate("SplitInputScreen", {
      mode: "edit",
      entryId,
      userId: friendId,
      userName: friendName,
    });
  };

  const goToTransaction = () => {
    if (transaction) {
      navigation.navigate("TransactionEdit", { transaction, mode: "edit" });
    } else {
      navigation.navigate("TransactionEdit", {
        transaction: {
          description,
          amount: myOwe / 100,
          date_time: createdAt || new Date().toISOString(),
        },
        mode: "add",
        entryId,
      });
    }
  };

  if (loading) {
    return (
      <Page title="Split">
        <SkeletonList rows={4} />
      </Page>
    );
  }

  const fileTypes = Array.from(
    new Set(
      files.map((f) => (f.doc_type ? DOC_TYPE_LABELS[f.doc_type] : "Unsorted")),
    ),
  ).join("  ·  ");

  return (
    <Page
      title={description}
      hero={
        <DetailHero
          icon={linkedCategory ? linkedCategory.icon_name : "call-split"}
          iconType={
            linkedCategory ? linkedCategory.icon_type : "material-community"
          }
          iconColor={glyphColor}
          title={description}
          meta={subtitleParts.join("  ·  ")}
          label={headlineLabel}
          amountCents={headlineLabel === "All settled" ? null : headlineAmount}
          amountTone={headlineTone}
        />
      }
      footer={
        <BottomBar>
          <Button
            title="Edit split"
            icon="pencil-outline"
            onPress={handleEdit}
          />
          <Button
            title="Delete split"
            variant="destructive"
            onPress={handleDelete}
          />
        </BottomBar>
      }
    >
      <SplitBreakdownCard
        showBar={!isPayment}
        people={[
          { id: meId, name: "You", paidCents: myPaid, oweCents: myOwe },
          {
            id: friendId,
            name: friendName,
            paidCents: friendPaid,
            oweCents: friendOwe,
          },
        ]}
      />

      {(!isPayment || files.length > 0) && (
        <RowGroup inset={SPACE.lg + 34 + SPACE.md} style={styles.links}>
          {!isPayment && (
            <ListRow
              icon={transaction ? "receipt" : "plus-circle-outline"}
              iconColor={transaction ? COLORS.accent : COLORS.inkMuted}
              title={transaction ? "Logged as expense" : "Add as expense"}
              subtitle={
                transaction
                  ? `${linkedAccount?.name ?? "Account"}  ·  ${fmt(myOwe)}`
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
              onPress={() =>
                navigation.navigate("AttachmentViewer", {
                  attachments: files,
                  index: 0,
                })
              }
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

export default SplitSummaryScreen;
