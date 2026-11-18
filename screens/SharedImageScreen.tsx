import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Image,
  StyleSheet,
  StatusBar,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useExpensifyStore } from '../store/store';
import { parseImages, ImageParseStatus } from '../services/ImageParser';
import { useTheme } from '../contexts/ThemeContext';
import { ColorPalette } from '../constants/theme';
import { MOTION, RADIUS, SPACE } from '../constants';
import { BottomBar, Button, Form, Icon, InkCheck, Text, timing, toast } from '../components/ui';

const THUMB = 84;
const THUMB_RADIUS = RADIUS.lg;

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
  const transactions = useExpensifyStore((s) => s.transactions);
  const categories = useExpensifyStore((s) => s.categories);
  const accounts = useExpensifyStore((s) => s.accounts);

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
    };

    (async () => {
      const { transactions: txns, limitReached } = await parseImages(
        imageUris, transactions, categories, accounts, onSettled,
      );
      if (cancelled) return;
      if (limitReached) toast("You've hit today's scan limit. Add these by hand for now.", 'error');
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

  const title =
    phase === 'loading'
      ? multiple ? 'Scanning receipts' : 'Scanning receipt'
      : phase === 'empty' ? 'No receipts found' : 'Add expense';

  const footer =
    phase === 'choice' ? (
      <BottomBar>
        <Button title={multiple ? 'Add as expenses' : 'Add as expense'} onPress={() => handleChoice('transaction')} />
        <Button title="Split it with someone" variant="secondary" onPress={() => handleChoice('split')} />
      </BottomBar>
    ) : phase === 'empty' ? (
      <BottomBar>
        <Button title="Enter manually" onPress={handleManualEntry} />
      </BottomBar>
    ) : undefined;

  return (
    <Form title={title} onSave={() => {}} right={<View />} scroll={false} footer={footer}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={COLORS.paper} />

      {/* Thumbnail strip */}
      <View style={styles.thumbArea}>
        {imageUris.map((uri, i) => (
          <Thumb
            key={uri + i}
            uri={uri}
            status={statuses[i]}
            reading={phase === 'loading' && statuses[i] === 'pending'}
            styles={styles}
            COLORS={COLORS}
          />
        ))}
      </View>

      {/* Status */}
      <View style={styles.bottomContent}>
        {phase === 'choice' && (
          <Text variant="title" align="center">
            {multiple ? `Add these ${imageUris.length} as…` : 'Add this as…'}
          </Text>
        )}

        {phase === 'loading' && (
          <>
            <Text variant="title" align="center" style={styles.loadingTitle}>
              {multiple ? 'Reading receipts' : 'Reading receipt'}
            </Text>
            <Text variant="callout" tone="muted" align="center">
              {multiple
                ? `${doneCount} of ${imageUris.length} read`
                : 'Finding the amount, date and merchant'}
            </Text>
          </>
        )}

        {phase === 'empty' && (
          <>
            <Text variant="title" align="center" style={styles.loadingTitle}>
              No transactions found
            </Text>
            <Text variant="callout" tone="muted" align="center">
              {multiple
                ? "We couldn't read a transaction from any of these images."
                : "We couldn't read a transaction from this image."}
            </Text>
          </>
        )}
      </View>
    </Form>
  );
}

type Styles = ReturnType<typeof createStyles>;

// A receipt thumbnail: dimmed with a small spinner while it's read, then
// full strength with an inked check (or a quiet badge if nothing was found).
function Thumb({
  uri,
  status,
  reading,
  styles,
  COLORS,
}: {
  uri: string;
  status: ImageParseStatus;
  reading: boolean;
  styles: Styles;
  COLORS: ColorPalette;
}) {
  const dim = status === 'empty' || status === 'failed';
  const strength = useAnimatedStyle(() => ({
    opacity: withTiming(reading ? 0.6 : 1, timing(MOTION.base)),
  }));
  return (
    <View style={styles.thumb}>
      <Animated.View style={[StyleSheet.absoluteFill, strength]}>
        <Image source={{ uri }} style={styles.thumbImg} resizeMode="cover" />
      </Animated.View>
      {dim && <View style={styles.thumbDimOverlay} />}
      {reading && (
        <View style={[styles.badge, styles.badgeReading]}>
          <ActivityIndicator size="small" color="#fff" />
        </View>
      )}
      <InkCheck
        drawn={status === 'done'}
        size={24}
        color={COLORS.paper}
        background={COLORS.accent}
        style={styles.badge}
      />
      {dim && (
        <View style={[styles.badge, styles.badgeEmpty]}>
          <Icon name={status === 'failed' ? 'alert' : 'minus'} size={14} color="#fff" />
        </View>
      )}
    </View>
  );
}

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    thumbArea: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: SPACE.xl,
      gap: SPACE.md,
    },
    thumb: {
      width: THUMB,
      height: THUMB,
      borderRadius: THUMB_RADIUS,
      overflow: 'hidden',
      backgroundColor: COLORS.surface1,
    },
    thumbImg: {
      width: '100%',
      height: '100%',
    },
    thumbDimOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    badge: {
      position: 'absolute',
      top: SPACE.xs,
      right: SPACE.xs,
      width: 24,
      height: 24,
      borderRadius: RADIUS.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeReading: {
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    badgeEmpty: {
      backgroundColor: 'rgba(0,0,0,0.55)',
    },
    bottomContent: {
      flex: 1,
      paddingTop: SPACE.xxl,
      alignItems: 'center',
    },
    loadingTitle: {
      marginBottom: SPACE.sm,
    },
  });
