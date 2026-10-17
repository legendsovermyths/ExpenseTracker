import React, { useEffect, useRef, useState } from "react";
import { StyleProp, StyleSheet, TextStyle, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { FONT, TYPE } from "../../../constants";
import { useTheme } from "../../../contexts/ThemeContext";
import { peekTotalChange, subscribeTotal } from "../../../services/Feedback";
import { formatMoney } from "../Amount";

export interface DeltaChipProps {
  /** Feedback total key, e.g. "spent", "balance", "friend:<id>". */
  totalKey: string;
  /** Spend totals read "−₹420" in red when they go up; balances in green. */
  positiveIsGood?: boolean;
  /** White text for the gradient hero card. */
  onMedia?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** A small "+₹420" that rises next to a total and fades, after it changes. */
const DeltaChip: React.FC<DeltaChipProps> = ({
  totalKey,
  positiveIsGood = false,
  onMedia,
  style,
}) => {
  const { COLORS } = useTheme();
  const reduced = useReducedMotion();
  const [delta, setDelta] = useState<number | null>(null);
  const t = useSharedValue(0);
  const lastShown = useRef(0);

  useEffect(() => {
    const check = () => {
      const entry = peekTotalChange(totalKey);
      if (!entry || entry.at <= lastShown.current) return;
      lastShown.current = entry.at;
      setDelta(entry.delta);
      t.value = 0;
      t.value = withSequence(
        withTiming(1, {
          duration: reduced ? 100 : 260,
          easing: Easing.out(Easing.cubic),
        }),
        withDelay(900, withTiming(2, { duration: reduced ? 150 : 420 })),
      );
    };
    check();
    return subscribeTotal(totalKey, check);
  }, [totalKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => {
    const v = t.value;
    const opacity = v <= 1 ? v : 2 - v;
    const rise = reduced ? 0 : v <= 1 ? (1 - v) * 6 : -(v - 1) * 8;
    return { opacity, transform: [{ translateY: rise }] };
  });

  if (delta === null) return null;
  const good = positiveIsGood ? delta > 0 : delta < 0;
  const color = onMedia ? "#fff" : good ? COLORS.deltaDown : COLORS.deltaUp;
  return (
    <Animated.Text
      style={[styles.text, { color } as TextStyle, anim, style as any]}
    >
      {formatMoney(delta, "never", "always")}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  text: {
    ...TYPE.caption,
    fontFamily: FONT.bold,
    fontVariant: ["tabular-nums"],
  },
});

export default DeltaChip;
