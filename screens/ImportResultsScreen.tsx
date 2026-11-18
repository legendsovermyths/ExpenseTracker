import React, { useCallback, useContext, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ReloadContext } from "../contexts/ReloadContext";
import { useExpensifyStore } from "../store/store";
import TransactionCard from "../components/TransactionCard";
import {
  fetchImportBatch,
  fetchImportBatches,
  undoImportBatch,
} from "../services/SplitImport";
import { ImportBatchItem, ImportBatchSummary } from "../types/entity/SplitImport";
import {
  Amount,
  BottomBar,
  Button,
  EmptyState,
  ListRow,
  PageList,
  Pressable,
  SkeletonList,
  Text,
  confirm,
  toast,
} from "../components/ui";

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/** Past imports, or — with a `batchId` param — one import's transactions. */
function ImportResultsScreen() {
  const route = useRoute<any>();
  const batchId: string | undefined = route.params?.batchId;
  return batchId ? <BatchDetail batchId={batchId} /> : <BatchList />;
}

function BatchList() {
  const navigation = useNavigation<any>();
  const accounts = useExpensifyStore((s) => s.accounts);
  const [batches, setBatches] = useState<ImportBatchSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setBatches(await fetchImportBatches());
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load imports");
      setBatches([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <PageList
      title="Past imports"
      data={batches ?? []}
      keyExtractor={(b) => b.batch_id}
      estimatedItemSize={64}
      renderItem={({ item }) => {
        const bank = accounts[item.account_id]?.name;
        const cats = item.created_categories
          ? `${item.created_categories} new categor${item.created_categories === 1 ? "y" : "ies"}`
          : null;
        return (
          <ListRow
            icon="tray-arrow-down"
            title={`${item.count} split${item.count === 1 ? "" : "s"}`}
            subtitle={[formatDate(item.created_at), bank, cats].filter(Boolean).join("  ·  ")}
            trailing={<Amount cents={Math.round(item.total * 100)} variant="amount" />}
            chevron
            onPress={() => navigation.push("ImportResults", { batchId: item.batch_id })}
          />
        );
      }}
      ListEmptyComponent={
        batches === null ? (
          <SkeletonList rows={4} padded />
        ) : error ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load imports" message={error} actionLabel="Try again" onAction={load} />
        ) : (
          <EmptyState icon="tray-arrow-down" title="No imports yet" message="Splits you import show up here." />
        )
      }
    />
  );
}

function BatchDetail({ batchId }: { batchId: string }) {
  const navigation = useNavigation<any>();
  const { COLORS } = useTheme();
  const reload = useContext(ReloadContext);
  const [items, setItems] = useState<ImportBatchItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setItems(await fetchImportBatch(batchId));
    } catch (e: any) {
      setError(e?.message ?? "Couldn't load this import");
      setItems([]);
    }
  }, [batchId]);

  // Refresh on focus so category fixes made in the editor show up on return.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const undo = async () => {
    const ok = await confirm({
      title: "Undo this import?",
      message:
        "Its expenses are deleted and the splits go back to unimported. New categories it created are removed if nothing else uses them.",
      confirmLabel: "Undo import",
      destructive: true,
    });
    if (!ok) return;
    setUndoing(true);
    try {
      const res = await undoImportBatch(batchId);
      await reload();
      toast(`Removed ${res.removed_transactions} expense${res.removed_transactions === 1 ? "" : "s"}`);
      navigation.goBack();
    } catch (e: any) {
      toast(e?.message ?? "Couldn't undo the import", "error");
      setUndoing(false);
    }
  };

  const attention = (items ?? []).filter((i) => i.is_new_category || i.confidence === "low").length;

  return (
    <PageList
      title="Imported splits"
      subtitle={
        attention
          ? `${attention} to check: new categories and low-confidence picks are listed first. Tap one to change it.`
          : "Tap an expense to change its category."
      }
      data={items ?? []}
      extraData={COLORS}
      keyExtractor={(i) => i.entry_id}
      estimatedItemSize={72}
      renderItem={({ item }) => {
        const tag = item.is_new_category ? "New category" : item.confidence === "low" ? "Check category" : null;
        return (
          <Pressable
            feedback="highlight"
            onPress={() => navigation.navigate("TransactionEdit", { transaction: item.transaction, mode: "edit" })}
          >
            <View style={styles.row}>
              <TransactionCard item={item.transaction} />
              {tag && (
                <Text variant="label" tone={item.is_new_category ? "accent" : "warn"} style={styles.tag}>
                  {tag}
                </Text>
              )}
            </View>
          </Pressable>
        );
      }}
      footer={
        items && items.length > 0 ? (
          <BottomBar divider>
            <Button title="Undo import" variant="destructive" onPress={undo} loading={undoing} fullWidth />
          </BottomBar>
        ) : undefined
      }
      ListEmptyComponent={
        items === null ? (
          <SkeletonList rows={6} padded />
        ) : error ? (
          <EmptyState icon="alert-circle-outline" title="Couldn't load this import" message={error} actionLabel="Try again" onAction={load} />
        ) : (
          <EmptyState icon="tray-remove" title="Nothing left" message="Every expense from this import was deleted." />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: SPACE.gutter },
  tag: { marginTop: -SPACE.sm, marginBottom: SPACE.sm, marginLeft: 36 + SPACE.md },
});

export default ImportResultsScreen;
