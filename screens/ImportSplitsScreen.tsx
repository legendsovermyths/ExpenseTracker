import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { SPACE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { ReloadContext } from "../contexts/ReloadContext";
import { useExpensifyStore } from "../store/store";
import {
  defaultAccountId,
  discardPendingImport,
  fetchImportBatches,
  fetchUnlinkedSplits,
  ImportStatus,
  MAX_IMPORT_SPLITS,
  resumePendingImport,
  startSplitImport,
} from "../services/SplitImport";
import { UnlinkedSplit } from "../types/entity/SplitImport";
import {
  Amount,
  BottomBar,
  Button,
  EmptyState,
  formatMoney,
  HeaderTextButton,
  Icon,
  ListRow,
  PageList,
  Pressable,
  RowGroup,
  SegmentedControl,
  Sheet,
  SheetRef,
  SkeletonList,
  Stat,
  StatStrip,
  Text,
  confirm,
  toast,
} from "../components/ui";

type Range = "3m" | "6m" | "1y" | "all";
const RANGES: { key: Range; label: string }[] = [
  { key: "3m", label: "3 months" },
  { key: "6m", label: "6 months" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All" },
];
const POLL_MS = 4000;

const rangeStart = (r: Range): string | null => {
  if (r === "all") return null;
  const d = new Date();
  d.setMonth(d.getMonth() - (r === "3m" ? 3 : r === "6m" ? 6 : 12));
  return d.toISOString();
};

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

function ImportSplitsScreen() {
  const navigation = useNavigation<any>();
  const { COLORS } = useTheme();
  const reload = useContext(ReloadContext);
  const userId = useExpensifyStore((s) => s.userId);
  const accountsById = useExpensifyStore((s) => s.accounts);
  const accounts = useMemo(
    () => Object.values(accountsById).filter((a) => !a.is_deleted),
    [accountsById],
  );

  const [status, setStatus] = useState<ImportStatus | null>(null);
  const [splits, setSplits] = useState<UnlinkedSplit[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [accountId, setAccountId] = useState<number | null>(() => defaultAccountId());
  const [starting, setStarting] = useState(false);
  const [hasBatches, setHasBatches] = useState(false);
  const accountSheet = useRef<SheetRef>(null);

  const loadSplits = useCallback(async () => {
    if (!userId) return;
    try {
      setLoadError(null);
      const rows = await fetchUnlinkedSplits(userId, rangeStart(range));
      setSplits(rows);
      setSelected(new Set(rows.slice(0, MAX_IMPORT_SPLITS).map((r) => r.entry_id)));
    } catch (e: any) {
      setLoadError(e?.message ?? "Couldn't load splits");
      setSplits([]);
    }
  }, [userId, range]);

  const refreshStatus = useCallback(async () => {
    const s = await resumePendingImport(reload);
    setStatus(s);
    if (s.state === "applied" || s.state === "idle") {
      fetchImportBatches()
        .then((b) => setHasBatches(b.length > 0))
        .catch(() => {});
    }
    return s;
  }, [reload]);

  useFocusEffect(
    useCallback(() => {
      refreshStatus().then((s) => {
        if (s.state === "idle" || s.state === "applied") loadSplits();
      });
    }, [refreshStatus, loadSplits]),
  );

  // While the server works, poll so the screen fills in (and applies) on its own.
  useEffect(() => {
    if (status?.state !== "running") return;
    const t = setTimeout(() => {
      refreshStatus().then((s) => {
        if (s.state === "applied") loadSplits();
      });
    }, POLL_MS);
    return () => clearTimeout(t);
  }, [status, refreshStatus, loadSplits]);

  const selectedSplits = useMemo(
    () => (splits ?? []).filter((s) => selected.has(s.entry_id)),
    [splits, selected],
  );
  const totalCents = selectedSplits.reduce((n, s) => n + s.owed_cents, 0);
  const tooMany = selectedSplits.length > MAX_IMPORT_SPLITS;
  const account = accountId != null ? accountsById[accountId] : undefined;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allSelected = !!splits?.length && selected.size === splits.length;
  const toggleAll = () =>
    setSelected(allSelected ? new Set() : new Set((splits ?? []).map((s) => s.entry_id)));

  const start = async () => {
    if (!account || selectedSplits.length === 0 || tooMany) return;
    setStarting(true);
    try {
      const pending = await startSplitImport(selectedSplits, account.id);
      setStatus({ state: "running", pending, processed: 0, total: pending.total });
      toast("Categorising in the background. You can close the app.", "info");
    } catch (e: any) {
      toast(e?.message ?? "Couldn't start the import", "error");
    } finally {
      setStarting(false);
    }
  };

  const discard = async () => {
    const ok = await confirm({
      title: "Discard this import?",
      message: "Nothing has been added yet. Your splits stay as they are.",
      confirmLabel: "Discard",
      destructive: true,
    });
    if (!ok) return;
    try {
      await discardPendingImport();
      setStatus({ state: "idle" });
      loadSplits();
    } catch (e: any) {
      toast(e?.message ?? "Couldn't discard the import", "error");
    }
  };

  const running = status?.state === "running";
  const blocked = status?.state === "error" && status.pending;

  const header = (
    <View style={styles.header}>
      {running ? (
        <View style={styles.banner}>
          <Icon name="progress-clock" size="lg" color={COLORS.accent} />
          <View style={styles.bannerBody}>
            <Text variant="headline">
              Categorising {status.processed} of {status.total}
            </Text>
            <Text variant="callout" tone="muted">
              You can close the app. Your splits are added the next time you open it.
            </Text>
          </View>
        </View>
      ) : blocked ? (
        <View style={styles.banner}>
          <Icon name="alert-circle-outline" size="lg" color={COLORS.warn} />
          <View style={styles.bannerBody}>
            <Text variant="headline">The import needs attention</Text>
            <Text variant="callout" tone="muted">
              {status.message}
            </Text>
          </View>
        </View>
      ) : (
        <>
          <SegmentedControl value={range} onChange={setRange} options={RANGES} size="sm" />
          <StatStrip style={styles.stats}>
            <Stat value={<Text variant="title">{selectedSplits.length}</Text>} label="splits selected" />
            <Stat value={<Amount cents={totalCents} variant="amount" />} label="your share" />
          </StatStrip>
          <RowGroup>
            <ListRow
              icon="bank-outline"
              title="Bank"
              value={account?.name ?? "Choose"}
              valueTone={account ? "muted" : "accent"}
              chevron
              onPress={() => accountSheet.current?.present()}
            />
            {hasBatches && (
              <ListRow
                icon="history"
                title="Past imports"
                chevron
                onPress={() => navigation.navigate("ImportResults")}
              />
            )}
          </RowGroup>
          <Text variant="caption" tone="subtle" style={styles.hint}>
            Each split becomes an expense for your share. AI picks the category and may add new
            ones; you can change or undo it afterwards. Payments aren't included.
          </Text>
        </>
      )}
    </View>
  );

  const renderItem = ({ item }: { item: UnlinkedSplit }) => {
    const on = selected.has(item.entry_id);
    const who = item.grp_name ?? item.counterpart_name;
    return (
      <Pressable
        feedback="highlight"
        haptic="selection"
        onPress={() => toggle(item.entry_id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={item.description || "Split"}
      >
        <View style={styles.row}>
          <Icon
            name={on ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
            size="lg"
            color={on ? COLORS.accent : COLORS.inkSubtle}
          />
          <View style={styles.rowBody}>
            <Text variant="headline" numberOfLines={1}>
              {item.description || "Split"}
            </Text>
            <Text variant="callout" tone="muted" numberOfLines={1}>
              {[who, formatDate(item.created_at)].filter(Boolean).join("  ·  ")}
            </Text>
          </View>
          <Amount cents={item.owed_cents} variant="amount" tone={on ? "ink" : "subtle"} />
        </View>
      </Pressable>
    );
  };

  const showList = !running && !blocked;
  const footer = running ? (
    <BottomBar divider>
      <Button title="Cancel import" variant="destructive" onPress={discard} fullWidth />
    </BottomBar>
  ) : blocked ? (
    <BottomBar divider>
      <Button title="Try again" onPress={refreshStatus} fullWidth />
      <Button title="Discard import" variant="destructive" onPress={discard} fullWidth />
    </BottomBar>
  ) : splits && splits.length > 0 ? (
    <BottomBar divider>
      {tooMany && (
        <Text variant="caption" tone="warn" align="center">
          Select at most {MAX_IMPORT_SPLITS} splits per import.
        </Text>
      )}
      <Button
        title={`Import ${selectedSplits.length} · ${formatMoney(totalCents)}`}
        onPress={start}
        loading={starting}
        disabled={!account || selectedSplits.length === 0 || tooMany}
        fullWidth
      />
    </BottomBar>
  ) : undefined;

  return (
    <>
      <PageList
        title="Import splits"
        subtitle="Add your share of splits as expenses, categorised by AI."
        right={
          showList && splits?.length ? (
            <HeaderTextButton label={allSelected ? "None" : "All"} onPress={toggleAll} />
          ) : undefined
        }
        header={header}
        data={showList ? (splits ?? []) : []}
        extraData={{ selected, COLORS }}
        keyExtractor={(s) => s.entry_id}
        renderItem={renderItem}
        estimatedItemSize={64}
        footer={footer}
        ListEmptyComponent={
          !showList ? null : status === null || splits === null ? (
            <SkeletonList rows={6} padded />
          ) : loadError ? (
            <EmptyState
              icon="alert-circle-outline"
              title="Couldn't load splits"
              message={loadError}
              actionLabel="Try again"
              onAction={loadSplits}
            />
          ) : (
            <EmptyState
              icon="check-all"
              title="Nothing to import"
              message="Every split you owe a share of is already an expense."
            />
          )
        }
      />
      <Sheet ref={accountSheet} title="Bank">
        {accounts.length === 0 ? (
          <EmptyState icon="wallet-outline" title="No accounts yet" message="Add one from Settings → Accounts." />
        ) : (
          accounts.map((a) => {
            const active = a.id === accountId;
            return (
              <ListRow
                key={a.id}
                padded={false}
                icon="wallet-outline"
                iconColor={active ? COLORS.accent : COLORS.inkMuted}
                title={a.name}
                trailing={active ? <Icon name="check" size="md" color={COLORS.accent} /> : undefined}
                onPress={() => {
                  setAccountId(a.id);
                  accountSheet.current?.dismiss();
                }}
              />
            );
          })
        )}
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACE.gutter, gap: SPACE.lg, paddingBottom: SPACE.md },
  stats: { marginHorizontal: -SPACE.gutter },
  hint: { marginTop: -SPACE.xs },
  banner: { flexDirection: "row", gap: SPACE.md, alignItems: "flex-start", paddingVertical: SPACE.md },
  bannerBody: { flex: 1, gap: SPACE.xs },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.md,
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.gutter,
  },
  rowBody: { flex: 1, minWidth: 0 },
});

export default ImportSplitsScreen;
