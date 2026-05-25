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
import { parseImage } from '../services/ImageParser';
import { ParsedImageResult } from '../types/entity/ParsedImageResult';
import { UserBalance } from '../types/entity/UserBalance';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/theme';
import { FONTS, SIZES } from '../constants';

const { height: SH } = Dimensions.get('window');
const IMG_H = Math.min(Math.round(SH * 0.24), 200);

const SPLIT_TYPES = [
  { key: 'ME_PAY_EQUAL',    top: 'I paid',    bot: '50 / 50'      },
  { key: 'OTHER_PAY_EQUAL', top: 'They paid', bot: '50 / 50'      },
  { key: 'ME_OWE_ALL',      top: 'I paid',    bot: 'They owe all' },
  { key: 'OTHER_OWE_ALL',   top: 'They paid', bot: 'I owe all'    },
] as const;
type SplitTypeKey = typeof SPLIT_TYPES[number]['key'];

const AVATAR_PALETTE = [
  '#1e5c7d', '#7d3a1e', '#1e7d3a', '#7d1e5c', '#3a7d1e', '#5c1e7d', '#7d6b1e',
];
function avatarBg(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}
function initials(name: string): string {
  return name.trim().split(/\s+/).map(w => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
}
function fmtBalance(net: number): string {
  const abs = Math.abs(net / 100);
  return `${net > 0 ? '+' : '-'}₹${abs.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

export default function SplitPartnerScreen() {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri } = route.params as { imageUri: string };

  const userBalancesById = useExpensifyStore(s => s.userbalances);
  const transactions = useExpensifyStore(s => s.transactions);
  const categories = useExpensifyStore(s => s.categories);
  const accounts = useExpensifyStore(s => s.accounts);

  const allUsers = Object.values(userBalancesById)
    .sort((a, b) => Math.abs(b.net_cents) - Math.abs(a.net_cents));

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [splitType, setSplitType] = useState<SplitTypeKey>('ME_PAY_EQUAL');
  const [llmResult, setLlmResult] = useState<ParsedImageResult | null>(null);
  const [llmDone, setLlmDone] = useState(false);

  const scanY = useRef(new Animated.Value(0)).current;
  const doneScale = useRef(new Animated.Value(0)).current;

  // Scan line until LLM done
  useEffect(() => {
    if (llmDone) {
      Animated.spring(doneScale, { toValue: 1, useNativeDriver: true, tension: 100, friction: 7 }).start();
      return;
    }
    let active = true;
    const loop = () => {
      if (!active) return;
      scanY.setValue(0);
      Animated.timing(scanY, { toValue: IMG_H, duration: 2200, useNativeDriver: true })
        .start(({ finished }) => { if (finished && active) loop(); });
    };
    loop();
    return () => { active = false; };
  }, [llmDone]);

  // LLM — starts immediately
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let result: ParsedImageResult = { found: false };
      try { result = await parseImage(imageUri, transactions, categories, accounts); } catch {}
      if (!cancelled) { setLlmResult(result); setLlmDone(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  // Navigate when both user selected and LLM done
  useEffect(() => {
    if (!selectedId || !llmDone) return;
    const friend = userBalancesById[selectedId];
    if (!friend) return;
    const context = { imageUri, llmOutput: JSON.stringify(llmResult) };
    const txns = llmResult?.found ? (llmResult.transactions ?? []) : [];
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
  }, [selectedId, llmDone]);

  const select = useCallback((id: string) => setSelectedId(id), []);
  const selectedUser = selectedId ? userBalancesById[selectedId] : null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Split Expense</Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Image card */}
      <View style={styles.imageCard}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        <View style={styles.imageTint} />
        {!llmDone && (
          <Animated.View
            style={[styles.scanWrapper, { transform: [{ translateY: scanY }] }]}
            pointerEvents="none"
          >
            <View style={styles.scanGlow} />
            <View style={styles.scanLine} />
            <View style={styles.scanGlow} />
          </Animated.View>
        )}
        {/* Status badge */}
        <View style={[styles.badge, { backgroundColor: llmDone ? COLORS.primary + '15' : COLORS.lightGray }]}>
          {llmDone ? (
            <Animated.View style={[styles.badgeRow, { transform: [{ scale: doneScale }] }]}>
              <View style={[styles.badgeDot, { backgroundColor: COLORS.darkgreen }]} />
              <Text style={[styles.badgeText, { color: COLORS.darkgreen }]}>Bill scanned</Text>
            </Animated.View>
          ) : (
            <View style={styles.badgeRow}>
              <ActivityIndicator size="small" color={COLORS.primary} style={styles.badgeSpinner} />
              <Text style={[styles.badgeText, { color: COLORS.darkgray }]}>Analysing…</Text>
            </View>
          )}
        </View>
      </View>

      {/* Contact & split panel */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Contacts */}
        {allUsers.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>Split with</Text>
            <View style={styles.detailsCard}>
              {allUsers.map((u, i) => (
                <React.Fragment key={u.id}>
                  {i > 0 && <View style={styles.divider} />}
                  <ContactRow
                    user={u}
                    selected={selectedId === u.id}
                    onPress={() => select(u.id)}
                    styles={styles}
                    COLORS={COLORS}
                  />
                </React.Fragment>
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
        <Text style={[styles.sectionLabel, { marginTop: SIZES.padding }]}>How to split</Text>
        <View style={styles.splitGrid}>
          {SPLIT_TYPES.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[styles.splitPill, splitType === t.key && styles.splitPillActive]}
              onPress={() => setSplitType(t.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.splitTop, splitType === t.key && styles.splitTopActive]}>{t.top}</Text>
              <Text style={[styles.splitBot, splitType === t.key && styles.splitBotActive]}>{t.bot}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.ctaWrap}>
        {!selectedUser ? (
          <View style={[styles.cta, styles.ctaDisabled]}>
            <Text style={styles.ctaTextDim}>Select someone to split with</Text>
          </View>
        ) : !llmDone ? (
          <View style={[styles.cta, styles.ctaWaiting]}>
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginRight: 10 }} />
            <Text style={[styles.ctaText, { color: COLORS.primary }]}>Analysing bill…</Text>
          </View>
        ) : (
          <View style={[styles.cta, { backgroundColor: COLORS.primary }]}>
            <ActivityIndicator size="small" color={COLORS.white} style={{ marginRight: 10 }} />
            <Text style={styles.ctaText}>Opening split…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function ContactRow({
  user, selected, onPress, styles, COLORS,
}: {
  user: UserBalance;
  selected: boolean;
  onPress: () => void;
  styles: ReturnType<typeof createStyles>;
  COLORS: ColorPalette;
}) {
  const bg = avatarBg(user.name);
  const net = user.net_cents;
  const label = net > 0
    ? `owes you ${fmtBalance(net).replace(/[+-]/, '')}`
    : net < 0
      ? `you owe ${fmtBalance(net).replace(/[+-]/, '')}`
      : 'Settled';
  const balColor = net > 0 ? COLORS.darkgreen : net < 0 ? COLORS.red2 : COLORS.darkgray;

  return (
    <TouchableOpacity style={styles.fieldRow} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.avatar, { backgroundColor: bg }]}>
        <Text style={styles.avatarText}>{initials(user.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.contactName}>{user.name}</Text>
        <Text style={[styles.contactBal, { color: balColor }]}>{label}</Text>
      </View>
      {selected
        ? <Icon name="check-circle" type="material-community" size={20} color={COLORS.primary} />
        : <Icon name="chevron-right" type="material-community" size={20} color={COLORS.gray} />
      }
    </TouchableOpacity>
  );
}

const createStyles = (COLORS: ColorPalette) => {
  const { width: SW } = Dimensions.get('window');
  const PILL_W = (SW - SIZES.padding * 2 - 10) / 2;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: COLORS.white,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 2.5,
      paddingBottom: SIZES.base,
    },
    headerBtn: {
      padding: 4,
      width: 32,
    },
    headerTitle: {
      ...FONTS.h3,
      color: COLORS.primary,
      fontWeight: '600',
    },
    imageCard: {
      marginHorizontal: SIZES.padding,
      height: IMG_H,
      borderRadius: SIZES.radius + 2,
      overflow: 'hidden',
      backgroundColor: COLORS.lightGray,
    },
    image: { width: '100%', height: '100%' },
    imageTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.10)',
    },
    scanWrapper: { position: 'absolute', left: 0, right: 0, top: 0 },
    scanGlow: { height: 18, backgroundColor: COLORS.primary + '1A' },
    scanLine: { height: 2, backgroundColor: COLORS.primary, opacity: 0.65 },
    badge: {
      position: 'absolute',
      bottom: 10,
      right: 12,
      borderRadius: 20,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    badgeRow: { flexDirection: 'row', alignItems: 'center' },
    badgeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6 },
    badgeSpinner: { marginRight: 6 },
    badgeText: { ...FONTS.body4, fontSize: 12, fontWeight: '500' },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: SIZES.padding, paddingTop: SIZES.base + 4 },

    sectionLabel: {
      ...FONTS.body4,
      fontSize: 11,
      color: COLORS.darkgray,
      fontWeight: '600',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: SIZES.base + 4,
    },

    detailsCard: {
      backgroundColor: COLORS.lightGray,
      borderRadius: SIZES.radius + 2,
      overflow: 'hidden',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SIZES.padding * 0.7,
      paddingVertical: SIZES.base + 5,
      gap: SIZES.base + 2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: COLORS.gray,
      marginHorizontal: SIZES.padding * 0.7,
      opacity: 0.35,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: { color: '#fff', fontSize: 14, fontWeight: '700', fontFamily: 'Roboto-Bold' },
    contactName: { ...FONTS.body3, color: COLORS.primary, fontWeight: '600' },
    contactBal: { ...FONTS.body4, fontSize: 12, marginTop: 2 },

    splitGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    splitPill: {
      width: PILL_W,
      backgroundColor: COLORS.lightGray,
      borderRadius: SIZES.radius,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: 'transparent',
    },
    splitPillActive: {
      borderColor: COLORS.primary,
      backgroundColor: COLORS.primary + '0D',
    },
    splitTop: { ...FONTS.body4, color: COLORS.darkgray, fontWeight: '600' },
    splitTopActive: { color: COLORS.primary },
    splitBot: { ...FONTS.body4, fontSize: 12, color: COLORS.gray, marginTop: 3 },
    splitBotActive: { color: COLORS.primary },

    ctaWrap: {
      paddingHorizontal: SIZES.padding,
      paddingBottom: 30,
      paddingTop: 12,
      backgroundColor: COLORS.white,
    },
    cta: {
      height: 52,
      borderRadius: SIZES.radius,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },
    ctaDisabled: { backgroundColor: COLORS.lightGray },
    ctaWaiting: { backgroundColor: COLORS.lightGray },
    ctaText: { ...FONTS.h4, color: COLORS.white },
    ctaTextDim: { ...FONTS.body3, color: COLORS.darkgray },

    emptyState: { alignItems: 'center', paddingVertical: SIZES.padding * 1.5 },
    emptyTitle: { ...FONTS.h4, color: COLORS.darkgray, marginTop: SIZES.base + 4, marginBottom: 6 },
    emptySub: { ...FONTS.body4, color: COLORS.gray, textAlign: 'center', lineHeight: 20 },
  });
};
