import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useExpensifyStore } from '../store/store';
import { parseImages } from '../services/ImageParser';
import { ParsedTransaction } from '../types/entity/ParsedImageResult';
import { UserBalance } from '../types/entity/UserBalance';
import {
  Amount,
  Avatar,
  BottomBar,
  Button,
  EmptyState,
  Form,
  Icon,
  ListRow,
  Pressable,
  RowGroup,
  SectionLabel,
  Skeleton,
  Text,
} from '../components/ui';
import { useTheme } from '../contexts/ThemeContext';
import { FONT, RADIUS, SPACE } from '../constants';

const SPLIT_TYPES = [
  { key: 'ME_PAY_EQUAL',    top: 'I paid',    bot: 'Split 50 / 50' },
  { key: 'OTHER_PAY_EQUAL', top: 'They paid', bot: 'Split 50 / 50' },
  { key: 'ME_OWE_ALL',      top: 'I paid',    bot: 'They owe all'  },
  { key: 'OTHER_OWE_ALL',   top: 'They paid', bot: 'I owe all'     },
] as const;
type SplitTypeKey = typeof SPLIT_TYPES[number]['key'];

function fmtBalance(net: number): string {
  const abs = Math.abs(net / 100);
  return `₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}
const fmtRupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export default function SplitPartnerScreen() {
  const { COLORS } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const rawParams = route.params as { imageUris?: string[]; imageUri?: string };
  const imageUris = useMemo(
    () => rawParams.imageUris ?? (rawParams.imageUri ? [rawParams.imageUri] : []),
    [],
  );

  const userBalancesById = useExpensifyStore(s => s.userbalances);
  const transactions = useExpensifyStore(s => s.transactions);
  const categories = useExpensifyStore(s => s.categories);
  const accounts = useExpensifyStore(s => s.accounts);

  const allUsers = Object.values(userBalancesById)
    .sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SplitTypeKey>('ME_PAY_EQUAL');
  const [parsedTxns, setParsedTxns] = useState<ParsedTransaction[]>([]);
  const [llmDone, setLlmDone] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  // Parse every shared image in parallel; partial failures are dropped.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { transactions: txns } = await parseImages(imageUris, transactions, categories, accounts);
      if (!cancelled) { setParsedTxns(txns); setLlmDone(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Navigate once the user has confirmed AND parsing has finished.
  useEffect(() => {
    if (!confirmed || !selectedId || !llmDone) return;
    const friend = userBalancesById[selectedId];
    if (!friend) return;
    const txns = parsedTxns;
    // Each txn carries its own origin; expose the first as the legacy context.
    const context = txns[0]?.__imageUri
      ? { imageUri: txns[0].__imageUri, llmOutput: txns[0].__llmOutput }
      : { imageUri: imageUris[0], llmOutput: '{"found":false}' };
    if (txns.length > 1) {
      navigation.replace('SplitInputScreen', {
        userId: friend.id,
        userName: friend.name,
        initialSplitType: splitType,
        prefill: txns[0],
        bulkQueue: txns,
        bulkIndex: 0,
        imageParseContext: context,
      });
    } else {
      navigation.replace('SplitInputScreen', {
        userId: friend.id,
        userName: friend.name,
        initialSplitType: splitType,
        prefill: txns[0] ?? undefined,
        imageParseContext: context,
      });
    }
  }, [confirmed, selectedId, llmDone]);

  const select = useCallback((id: string) => setSelectedId(id), []);

  const selectedUser = selectedId ? userBalancesById[selectedId] : null;

  const total = parsedTxns.reduce((s, t) => s + (t.amount ?? 0), 0);
  const summaryTitle = parsedTxns.length === 1
    ? (parsedTxns[0].description?.trim() || 'Expense')
    : `${parsedTxns.length} expenses`;

  const ctaLabel = !selectedUser
    ? 'Select who to split with'
    : llmDone && total > 0
      ? `Split ${fmtRupees(total)} with ${selectedUser.name}`
      : `Split with ${selectedUser.name}`;

  return (
    <Form
      title="New split"
      onSave={() => setConfirmed(true)}
      right={<View />}
      footer={
        <BottomBar>
          <Button
            title={confirmed ? (llmDone ? "Opening…" : "Analysing bill…") : ctaLabel}
            loading={confirmed}
            disabled={!selectedUser || confirmed}
            onPress={() => setConfirmed(true)}
          />
        </BottomBar>
      }
    >
      {/* Progressive summary: receipt thumbnail + merchant/amount (fills in) */}
      <View style={styles.summary}>
        <View style={[styles.thumbBox, { backgroundColor: COLORS.surface1 }]}>
          {imageUris[0] ? (
            <Image source={{ uri: imageUris[0] }} style={styles.thumbImg} resizeMode="cover" />
          ) : (
            <Icon name="receipt" size="lg" color={COLORS.inkSubtle} />
          )}
          {imageUris.length > 1 && (
            <View style={styles.thumbCount}>
              <Text variant="caption" style={styles.onScrim}>+{imageUris.length - 1}</Text>
            </View>
          )}
        </View>
        <View style={styles.summaryBody}>
          {!llmDone ? (
            <>
              <Skeleton width="45%" height={11} />
              <Skeleton width="70%" height={22} style={styles.skelGap} />
              <Text variant="caption" tone="subtle" style={styles.hint}>Reading receipt…</Text>
            </>
          ) : parsedTxns.length === 0 ? (
            <>
              <Text variant="headline" tone="muted">Couldn't read the amount</Text>
              <Text variant="caption" tone="subtle" style={styles.hint}>You can add it on the next step</Text>
            </>
          ) : (
            <>
              <Text variant="headline" tone="muted" numberOfLines={1}>{summaryTitle}</Text>
              <Amount cents={Math.round(total * 100)} decimals="never" variant="amountLarge" />
            </>
          )}
        </View>
        {llmDone && parsedTxns.length > 0 && <Icon name="check-circle" size="md" color={COLORS.deltaDown} />}
      </View>

      {allUsers.length > 0 ? (
        <>
          <SectionLabel title="Split with" />
          <View style={styles.peopleGrid}>
            {allUsers.map((u) => (
              <PersonCell key={u.id} user={u} selected={selectedId === u.id} onPress={() => select(u.id)} />
            ))}
          </View>
        </>
      ) : (
        <EmptyState icon="account-group-outline" title="No contacts yet" message="Add friends from the Balances tab to start splitting." />
      )}

      <SectionLabel title="How it splits" />
      <RowGroup>
        {SPLIT_TYPES.map((t) => (
          <ListRow
            key={t.key}
            title={t.top}
            subtitle={t.bot}
            onPress={() => setSplitType(t.key)}
            trailing={
              <Icon
                name={splitType === t.key ? "check-circle" : "circle-outline"}
                size="md"
                color={splitType === t.key ? COLORS.accent : COLORS.inkSubtle}
              />
            }
          />
        ))}
      </RowGroup>
    </Form>
  );
}

function PersonCell({ user, selected, onPress }: { user: UserBalance; selected: boolean; onPress: () => void }) {
  const { COLORS } = useTheme();
  const net = user.net_cents;
  const balLabel = net > 0 ? `owes ${fmtBalance(net)}` : net < 0 ? `you owe ${fmtBalance(net)}` : "settled";
  return (
    <Pressable style={styles.personCell} onPress={onPress} haptic="selection" accessibilityState={{ selected }}>
      <View style={[styles.avatarRing, { borderColor: selected ? COLORS.accent : "transparent" }]}>
        <Avatar name={user.name} size={56} />
        {selected && (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={[styles.checkBadge, { backgroundColor: COLORS.accent, borderColor: COLORS.paper }]}>
            <Icon name="check" size={14} color={COLORS.paper} />
          </Animated.View>
        )}
      </View>
      <Text variant="callout" tone={selected ? "ink" : "muted"} numberOfLines={1} style={styles.personName}>
        {user.name}
      </Text>
      <Text variant="caption" tone={net > 0 ? "down" : net < 0 ? "up" : "subtle"} numberOfLines={1}>
        {balLabel}
      </Text>
    </Pressable>
  );
}

const { width: SW } = Dimensions.get("window");
const COLS = 3;
const GAP = SPACE.md;
const CELL_W = (SW - SPACE.gutter * 2 - GAP * (COLS - 1)) / COLS;

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "center", gap: SPACE.md, marginTop: SPACE.sm },
  thumbBox: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImg: { width: "100%", height: "100%" },
  thumbCount: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: SPACE.xs,
    borderTopLeftRadius: RADIUS.sm,
  },
  onScrim: { color: "#fff" },
  summaryBody: { flex: 1, justifyContent: "center" },
  skelGap: { marginTop: SPACE.sm },
  hint: { marginTop: SPACE.xs },
  peopleGrid: { flexDirection: "row", flexWrap: "wrap", columnGap: GAP, rowGap: SPACE.lg },
  personCell: { width: CELL_W, alignItems: "center" },
  avatarRing: { borderRadius: 36, padding: 3, borderWidth: 2 },
  checkBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  personName: { marginTop: SPACE.xs + 2, fontFamily: FONT.bold },
});
