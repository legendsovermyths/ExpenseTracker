import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Icon } from 'react-native-elements';
import { useExpensifyStore } from '../store/store';
import { parseImage } from '../services/ImageParser';
import { ParsedImageResult } from '../types/entity/ParsedImageResult';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/theme';
import { FONTS, SIZES } from '../constants';

const { height: SH } = Dimensions.get('window');
const IMAGE_H = Math.min(SH * 0.36, 290);

const STATUSES = [
  'Extracting details',
  'Reading amounts',
  'Identifying merchant',
  'Matching categories',
  'Finalising results',
];

export default function SharedImageScreen() {
  const { COLORS, isDark } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { imageUri, action: routeAction } = route.params as {
    imageUri: string;
    action?: string | null;
  };

  const [phase, setPhase] = useState<'choice' | 'loading'>(
    routeAction === 'transaction' ? 'loading' : 'choice',
  );
  const [action, setAction] = useState<string | null>(
    routeAction === 'transaction' ? 'transaction' : null,
  );
  const [statusIdx, setStatusIdx] = useState(0);
  const [dots, setDots] = useState('');

  const transactions = useExpensifyStore((s) => s.transactions);
  const categories = useExpensifyStore((s) => s.categories);
  const accounts = useExpensifyStore((s) => s.accounts);

  const scanY = useRef(new Animated.Value(0)).current;

  // Scan line loops while loading
  useEffect(() => {
    if (phase !== 'loading') return;
    let running = true;
    const loop = () => {
      if (!running) return;
      scanY.setValue(0);
      Animated.timing(scanY, { toValue: IMAGE_H, duration: 2200, useNativeDriver: true }).start(
        ({ finished }) => { if (finished && running) loop(); },
      );
    };
    loop();
    return () => { running = false; };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const t = setInterval(() => setDots((d) => (d.length >= 3 ? '' : d + '.')), 450);
    return () => clearInterval(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'loading') return;
    const t = setInterval(() => setStatusIdx((i) => (i + 1) % STATUSES.length), 2000);
    return () => clearInterval(t);
  }, [phase]);

  // LLM call — fires whenever loading phase starts
  useEffect(() => {
    if (phase !== 'loading' || !action) return;
    let cancelled = false;
    (async () => {
      let result: ParsedImageResult = { found: false };
      try { result = await parseImage(imageUri, transactions, categories, accounts); } catch {}
      if (cancelled) return;
      const context = { imageUri, llmOutput: JSON.stringify(result) };
      const txns = result.found ? (result.transactions ?? []) : [];
      if (txns.length > 1) {
        navigation.replace('AddTransaction', {
          prefill: txns[0],
          bulkQueue: txns,
          bulkIndex: 0,
          imageParseContext: context,
        });
      } else {
        navigation.replace('AddTransaction', {
          prefill: txns[0] ?? undefined,
          imageParseContext: context,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [phase, action]);

  const handleChoice = useCallback((chosen: string) => {
    if (chosen === 'split') {
      navigation.navigate('SplitPartner', { imageUri });
      return;
    }
    setAction(chosen);
    setPhase('loading');
  }, [imageUri]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.white} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Icon name="close" type="material-community" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {phase === 'loading' ? 'Scanning Receipt' : 'Add Expense'}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      {/* Image card */}
      <View style={styles.imageCard}>
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
        {phase === 'loading' && (
          <>
            <View style={styles.imageTint} />
            <Animated.View
              style={[styles.scanWrapper, { transform: [{ translateY: scanY }] }]}
              pointerEvents="none"
            >
              <View style={styles.scanGlow} />
              <View style={styles.scanLine} />
              <View style={styles.scanGlow} />
            </Animated.View>
          </>
        )}
      </View>

      {/* Bottom content */}
      <View style={styles.bottomContent}>
        {phase === 'choice' ? (
          <>
            <Text style={styles.choiceTitle}>Add this as…</Text>
            <TouchableOpacity style={styles.btnPrimary} onPress={() => handleChoice('transaction')} activeOpacity={0.8}>
              <Text style={styles.btnPrimaryText}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnSecondary} onPress={() => handleChoice('split')} activeOpacity={0.8}>
              <Text style={styles.btnSecondaryText}>Split Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <ActivityIndicator size="small" color={COLORS.primary} style={styles.spinner} />
            <Text style={styles.loadingTitle}>{STATUSES[statusIdx]}{dots}</Text>
            <Text style={styles.loadingSub}>AI is reading your receipt</Text>
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
    imageCard: {
      marginHorizontal: SIZES.padding,
      height: IMAGE_H,
      borderRadius: SIZES.radius + 2,
      overflow: 'hidden',
      backgroundColor: COLORS.lightGray,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    imageTint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.12)',
    },
    scanWrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
    },
    scanGlow: {
      height: 18,
      backgroundColor: COLORS.primary + '20',
    },
    scanLine: {
      height: 2,
      backgroundColor: COLORS.primary,
      opacity: 0.65,
    },
    bottomContent: {
      flex: 1,
      paddingHorizontal: SIZES.padding,
      paddingTop: SIZES.padding + 4,
      alignItems: 'center',
    },
    choiceTitle: {
      ...FONTS.h3,
      color: COLORS.black,
      marginBottom: SIZES.padding,
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
    spinner: {
      marginBottom: 16,
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
