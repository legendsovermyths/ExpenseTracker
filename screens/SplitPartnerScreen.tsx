import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Icon } from 'react-native-elements';
import { useExpensifyStore } from '../store/store';
import { parseImages } from '../services/ImageParser';
import { ParsedTransaction } from '../types/entity/ParsedImageResult';
import { UserBalance } from '../types/entity/UserBalance';
import { Avatar } from '../components/primitives';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/theme';
import { FONTS, SIZES } from '../constants';

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
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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

  const shimmer = useRef(new Animated.Value(0)).current;
  const selAnim = useRef(new Animated.Value(0)).current;

  // Skeleton shimmer on the summary card while the receipt(s) are scanning.
  useEffect(() => {
    if (llmDone) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [llmDone]);
  const shimmerOpacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.75] });

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

  const select = useCallback((id: string) => {
    setSelectedId(id);
    selAnim.setValue(0);
    Animated.spring(selAnim, { toValue: 1, useNativeDriver: true, tension: 140, friction: 6 }).start();
  }, [selAnim]);

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
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Split</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Progressive summary: receipt thumbnail + merchant/amount (fills in) */}
        <View style={styles.summaryCard}>
          <View style={styles.thumbBox}>
            {imageUris[0] ? (
              <Image source={{ uri: imageUris[0] }} style={styles.thumbImg} resizeMode="cover" />
            ) : (
              <Icon name="receipt" type="material-community" size={24} color={COLORS.gray} />
            )}
            {imageUris.length > 1 && (
              <View style={styles.thumbCount}>
                <Text style={styles.thumbCountText}>+{imageUris.length - 1}</Text>
              </View>
            )}
          </View>

          <View style={styles.summaryBody}>
            {!llmDone ? (
              <>
                <Animated.View style={[styles.skelSm, { opacity: shimmerOpacity }]} />
                <Animated.View style={[styles.skelLg, { opacity: shimmerOpacity }]} />
                <Text style={styles.summaryHint}>Reading receipt…</Text>
              </>
            ) : parsedTxns.length === 0 ? (
              <>
                <Text style={styles.summaryMerchant}>Couldn't read the amount</Text>
                <Text style={styles.summaryHint}>You can add it on the next step</Text>
              </>
            ) : (
              <>
                <Text style={styles.summaryMerchant} numberOfLines={1}>{summaryTitle}</Text>
                <Text style={styles.summaryAmount}>{fmtRupees(total)}</Text>
              </>
            )}
          </View>

          {llmDone && parsedTxns.length > 0 && (
            <View style={styles.scannedTick}>
              <Icon name="check" type="material-community" size={13} color={COLORS.white} />
            </View>
          )}
        </View>

        {/* People picker */}
        {allUsers.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Split with</Text>
            <View style={styles.peopleGrid}>
              {allUsers.map((u) => (
                <PersonCell
                  key={u.id}
                  user={u}
                  selected={selectedId === u.id}
                  selAnim={selAnim}
                  onPress={() => select(u.id)}
                  styles={styles}
                  COLORS={COLORS}
                />
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Icon name="account-group-outline" type="material-community" size={36} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.emptySub}>Add friends from the Balances tab to start splitting.</Text>
          </View>
        )}

        {/* Split type */}
        <Text style={[styles.sectionLabel, { marginTop: SIZES.padding * 1.2 }]}>How it splits</Text>
        <View style={styles.splitGrid}>
          {SPLIT_TYPES.map(t => {
            const active = splitType === t.key;
            return (
              <TouchableOpacity
                key={t.key}
                style={[styles.splitPill, active && styles.splitPillActive]}
                onPress={() => setSplitType(t.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.splitTop, active && styles.splitTextActive]}>{t.top}</Text>
                <Text style={[styles.splitBot, active && styles.splitTextActive]}>{t.bot}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaWrap}>
        <TouchableOpacity
          style={[styles.cta, selectedUser ? styles.ctaActive : styles.ctaDisabled]}
          disabled={!selectedUser || confirmed}
          onPress={() => setConfirmed(true)}
          activeOpacity={0.85}
        >
          {confirmed ? (
            <>
              <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 10 }} />
              <Text style={styles.ctaText}>{llmDone ? 'Opening…' : 'Analysing bill…'}</Text>
            </>
          ) : (
            <Text style={[styles.ctaText, !selectedUser && styles.ctaTextDim]}>{ctaLabel}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PersonCell({
  user, selected, selAnim, onPress, styles, COLORS,
}: {
  user: UserBalance;
  selected: boolean;
  selAnim: Animated.Value;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  COLORS: ColorPalette;
}) {
  const net = user.net_cents;
  const balLabel = net > 0
    ? `owes ${fmtBalance(net)}`
    : net < 0
      ? `you owe ${fmtBalance(net)}`
      : 'settled';
  const balColor = net > 0 ? COLORS.darkgreen : net < 0 ? COLORS.red2 : COLORS.gray;

  return (
    <TouchableOpacity style={styles.personCell} onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.avatarWrap, selected && styles.avatarWrapSel]}>
        <Avatar name={user.name} size={56} />
        {selected && (
          <Animated.View style={[styles.checkBadge, { transform: [{ scale: selAnim }] }]}>
            <Icon name="check" type="material-community" size={14} color={COLORS.white} />
          </Animated.View>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.personName, selected && { color: COLORS.primary }]}>
        {user.name}
      </Text>
      <Text numberOfLines={1} style={[styles.personBal, { color: balColor }]}>{balLabel}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS: ColorPalette) => {
  const { width: SW } = Dimensions.get('window');
  const COLS = 3;
  const GAP = 14;
  const PILL_W = (SW - SIZES.padding * 2 - 10) / 2;
  const CELL_W = (SW - SIZES.padding * 2 - GAP * (COLS - 1)) / COLS;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.white },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: { padding: 4, width: 32 },
    headerTitle: { ...FONTS.h3, color: COLORS.primary, fontWeight: '600' },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: SIZES.padding, paddingTop: SIZES.base + 2 },

    // ── Summary card ──
    summaryCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: COLORS.lightGray,
      borderRadius: SIZES.radius + 4,
      padding: 14,
      gap: 14,
      marginBottom: SIZES.padding * 1.3,
    },
    thumbBox: {
      width: 56,
      height: 56,
      borderRadius: 12,
      backgroundColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    thumbImg: { width: '100%', height: '100%' },
    thumbCount: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      backgroundColor: 'rgba(0,0,0,0.65)',
      paddingHorizontal: 5,
      paddingVertical: 1,
      borderTopLeftRadius: 8,
    },
    thumbCountText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    summaryBody: { flex: 1, justifyContent: 'center' },
    summaryMerchant: { ...FONTS.body3, color: COLORS.darkgray, fontWeight: '600' },
    summaryAmount: { fontSize: 26, fontWeight: '700', color: COLORS.black, marginTop: 2 },
    summaryHint: { ...FONTS.body4, fontSize: 12, color: COLORS.gray, marginTop: 4 },
    skelSm: { width: '45%', height: 11, borderRadius: 6, backgroundColor: COLORS.gray },
    skelLg: { width: '70%', height: 22, borderRadius: 7, backgroundColor: COLORS.gray, marginTop: 8 },
    scannedTick: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: COLORS.darkgreen,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },

    sectionLabel: {
      ...FONTS.body4,
      fontSize: 11,
      color: COLORS.darkgray,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: SIZES.base + 6,
    },

    // ── People grid ──
    peopleGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: GAP,
      rowGap: 18,
    },
    personCell: { width: CELL_W, alignItems: 'center' },
    avatarWrap: {
      borderRadius: 36,
      padding: 3,
      borderWidth: 2.5,
      borderColor: 'transparent',
    },
    avatarWrapSel: { borderColor: COLORS.primary },
    checkBadge: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: COLORS.primary,
      borderWidth: 2,
      borderColor: COLORS.white,
      alignItems: 'center',
      justifyContent: 'center',
    },
    personName: { ...FONTS.body4, color: COLORS.black, fontWeight: '600', marginTop: 7 },
    personBal: { ...FONTS.body4, fontSize: 11, marginTop: 1 },

    // ── Split type ──
    splitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    splitPill: {
      width: PILL_W,
      backgroundColor: COLORS.lightGray,
      borderRadius: SIZES.radius,
      paddingVertical: 14,
      paddingHorizontal: 14,
    },
    splitPillActive: { backgroundColor: COLORS.primary },
    splitTop: { ...FONTS.body3, color: COLORS.black, fontWeight: '700' },
    splitBot: { ...FONTS.body4, fontSize: 12, color: COLORS.darkgray, marginTop: 3 },
    splitTextActive: { color: COLORS.white },

    // ── CTA ──
    ctaWrap: {
      paddingHorizontal: SIZES.padding,
      paddingBottom: 30,
      paddingTop: 12,
      backgroundColor: COLORS.white,
    },
    cta: {
      height: 54,
      borderRadius: SIZES.radius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaActive: { backgroundColor: COLORS.primary },
    ctaDisabled: { backgroundColor: COLORS.lightGray },
    ctaText: { ...FONTS.h4, color: COLORS.white },
    ctaTextDim: { ...FONTS.body3, color: COLORS.darkgray, fontWeight: '600' },

    emptyState: { alignItems: 'center', paddingVertical: SIZES.padding * 1.5 },
    emptyTitle: { ...FONTS.h4, color: COLORS.darkgray, marginTop: SIZES.base + 4, marginBottom: 6 },
    emptySub: { ...FONTS.body4, color: COLORS.gray, textAlign: 'center', lineHeight: 20 },
  });
};
