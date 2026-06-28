import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  StatusBar,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Icon } from 'react-native-elements';
import { useExpensifyStore } from '../store/store';
import { parseImages, ImageParseStatus } from '../services/ImageParser';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/theme';
import { FONTS, SIZES } from '../constants';

const STATUSES = [
  'Extracting details',
  'Reading amounts',
  'Identifying merchant',
  'Matching categories',
  'Finalising results',
];

const THUMB = 84;
const THUMB_RADIUS = 14;

export default function SharedImageScreen() {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const params = route.params as {
    imageUris?: string[];
    imageUri?: string;
    action?: string | null;
  };
  // Accept the new imageUris[] param; fall back to the legacy single imageUri.
  const imageUris = useMemo(
    () => params.imageUris ?? (params.imageUri ? [params.imageUri] : []),
    [],
  );
  const routeAction = params.action;

  const [phase, setPhase] = useState<'choice' | 'loading' | 'empty'>(
    routeAction === 'transaction' ? 'loading' : 'choice',
  );
  const [statuses, setStatuses] = useState<ImageParseStatus[]>(
    imageUris.map(() => 'pending'),
  );
  const [statusIdx, setStatusIdx] = useState(0);
  const [dots, setDots] = useState('');

  const transactions = useExpensifyStore((s) => s.transactions);
  const categories = useExpensifyStore((s) => s.categories);
  const accounts = useExpensifyStore((s) => s.accounts);

  // ── Animations ────────────────────────────────────────────────────────────
  const scanY = useRef(new Animated.Value(0)).current;
  // Per-thumb: entrance (fade/slide) and the check-badge spring.
  const enter = useRef(imageUris.map(() => new Animated.Value(0))).current;
  const checkScale = useRef(imageUris.map(() => new Animated.Value(0))).current;

  // Staggered entrance for the thumbnails.
  useEffect(() => {
    Animated.stagger(
      80,
      enter.map((v) =>
        Animated.spring(v, { toValue: 1, useNativeDriver: true, tension: 80, friction: 9 }),
      ),
    ).start();
  }, []);

  const anyPending = statuses.some((s) => s === 'pending');

  // Scan-line sweep loops while any thumbnail is still parsing.
  useEffect(() => {
    if (phase !== 'loading' || !anyPending) return;
    let running = true;
    const loop = () => {
      if (!running) return;
      scanY.setValue(0);
      Animated.timing(scanY, { toValue: THUMB, duration: 1400, useNativeDriver: true }).start(
        ({ finished }) => { if (finished && running) loop(); },
      );
    };
    loop();
    return () => { running = false; };
  }, [phase, anyPending]);

  // Flavour text + dots while loading.
  useEffect(() => {
    if (phase !== 'loading') return;
    const d = setInterval(() => setDots((x) => (x.length >= 3 ? '' : x + '.')), 450);
    const s = setInterval(() => setStatusIdx((i) => (i + 1) % STATUSES.length), 2000);
    return () => { clearInterval(d); clearInterval(s); };
  }, [phase]);

  // ── Parse: fires when the loading phase starts ──────────────────────────────
  useEffect(() => {
    if (phase !== 'loading') return;
    let cancelled = false;

    const onSettled = (index: number, status: ImageParseStatus) => {
      if (cancelled) return;
      setStatuses((prev) => {
        const next = [...prev];
        next[index] = status;
        return next;
      });
      // Pop the check badge for images that yielded transactions.
      if (status === 'done') {
        Animated.spring(checkScale[index], {
          toValue: 1, useNativeDriver: true, tension: 110, friction: 7,
        }).start();
      }
    };

    (async () => {
      const { transactions: txns } = await parseImages(
        imageUris, transactions, categories, accounts, onSettled,
      );
      if (cancelled) return;
      if (txns.length === 0) {
        setPhase('empty');
        return;
      }
      // Each txn already carries __imageUri/__llmOutput, so no shared context.
      if (txns.length > 1) {
        navigation.replace('AddTransaction', {
          prefill: txns[0], bulkQueue: txns, bulkIndex: 0,
        });
      } else {
        navigation.replace('AddTransaction', { prefill: txns[0] });
      }
    })();

    return () => { cancelled = true; };
  }, [phase]);

  const handleChoice = useCallback((chosen: string) => {
    if (chosen === 'split') {
      navigation.navigate('SplitPartner', { imageUris });
      return;
    }
    setPhase('loading');
  }, [imageUris]);

  const handleManualEntry = useCallback(() => {
    navigation.replace('AddTransaction', {
      imageParseContext: imageUris[0]
        ? { imageUri: imageUris[0], llmOutput: '{"found":false}' }
        : undefined,
    });
  }, [imageUris]);

  const doneCount = statuses.filter((s) => s === 'done' || s === 'empty' || s === 'failed').length;
  const multiple = imageUris.length > 1;

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {phase === 'loading'
            ? multiple ? 'Scanning Receipts' : 'Scanning Receipt'
            : phase === 'empty' ? 'No Receipts Found' : 'Add Expense'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Thumbnail strip */}
      <View style={styles.thumbArea}>
        {imageUris.map((uri, i) => {
          const status = statuses[i];
          const scanning = phase === 'loading' && status === 'pending';
          const dim = status === 'empty' || status === 'failed';
          return (
            <Animated.View
              key={uri + i}
              style={[
                styles.thumb,
                {
                  opacity: enter[i],
                  transform: [
                    { scale: enter[i].interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) },
                  ],
                },
              ]}
            >
              <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />

              {/* parsing sweep */}
              {scanning && (
                <>
                  <View style={styles.thumbTint} />
                  <Animated.View
                    style={[styles.scanWrap, { transform: [{ translateY: scanY }] }]}
                    pointerEvents="none"
                  >
                    <View style={styles.scanGlow} />
                    <View style={styles.scanLine} />
                  </Animated.View>
                </>
              )}

              {/* empty / failed dim */}
              {dim && <View style={styles.thumbDimOverlay} />}

              {/* done check */}
              {status === 'done' && (
                <Animated.View style={[styles.badge, styles.badgeDone, { transform: [{ scale: checkScale[i] }] }]}>
                  <Icon name="check" type="material-community" size={16} color="#fff" />
                </Animated.View>
              )}
              {dim && (
                <View style={[styles.badge, styles.badgeEmpty]}>
                  <Icon
                    name={status === 'failed' ? 'alert' : 'minus'}
                    type="material-community" size={14} color="#fff"
                  />
                </View>
              )}
            </Animated.View>
          );
        })}
      </View>

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        {phase === 'choice' && (
          <>
            <Text style={styles.choiceTitle}>
              {multiple ? `Add these ${imageUris.length} as…` : 'Add this as…'}
            </Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => handleChoice('transaction')} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryText}>{multiple ? 'Expenses' : 'Expense'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => handleChoice('split')} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryText}>Split Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}

        {phase === 'loading' && (
          <>
            <Text style={styles.loadingTitle}>{STATUSES[statusIdx]}{dots}</Text>
            <Text style={styles.loadingSub}>
              {multiple
                ? `${doneCount} of ${imageUris.length} done`
                : 'AI is reading your receipt'}
            </Text>
          </>
        )}

        {phase === 'empty' && (
          <>
            <Text style={styles.choiceTitle}>No transactions found</Text>
            <Text style={styles.loadingSub}>
              {multiple
                ? "We couldn't read a transaction from any of these images."
                : "We couldn't read a transaction from this image."}
            </Text>
            <TouchableOpacity style={[styles.btnPrimary, { marginTop: SIZES.padding }]} onPress={handleManualEntry} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryText}>Enter Manually</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
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
    thumbArea: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding,
      gap: 12,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB_RADIUS,
      overflow: 'hidden',
      backgroundColor: COLORS.lightGray,
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    thumbTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.18)',
    },
    thumbDimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    scanWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    },
    scanGlow: {
      height: 14,
      backgroundColor: COLORS.primary + '22',
    },
    scanLine: {
      height: 2,
      backgroundColor: COLORS.primary,
      opacity: 0.7,
    },
    badge: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeDone: {
      backgroundColor: '#2ecc71',
    },
    badgeEmpty: {
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    bottomContent: {
      flex: 1,
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding * 1.5,
      alignItems: 'center',
    },
    choiceTitle: {
      ...FONTS.h3,
      color: COLORS.black,
      marginBottom: SIZES.padding,
      textAlign: 'center',
    },
    btnPrimary: {
      width: '100%',
      height: 52,
      borderRadius: SIZES.radius,
      backgroundColor: COLORS.primary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    btnPrimaryText: {
      ...FONTS.h4,
      color: COLORS.white,
    },
    btnSecondary: {
      width: '100%',
      height: 52,
      borderRadius: SIZES.radius,
      backgroundColor: COLORS.lightGray,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
    },
    btnSecondaryText: {
      ...FONTS.h4,
      color: COLORS.primary,
    },
    cancelBtn: {
      paddingVertical: 12,
      paddingHorizontal: 24,
    },
    cancelText: {
      ...FONTS.body3,
      color: COLORS.darkgray,
    },
    loadingTitle: {
      ...FONTS.h3,
      color: COLORS.primary,
      textAlign: 'center',
      marginBottom: 8,
      minWidth: 220,
    },
    loadingSub: {
      ...FONTS.body4,
      color: COLORS.darkgray,
      textAlign: 'center',
    },
  });
