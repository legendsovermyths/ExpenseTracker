import React, { useEffect, useRef, useState } from "react";
import { StyleProp, StyleSheet, TextStyle, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { FONT, MOTION, TYPE } from "../../../constants";
import { useTheme } from "../../../contexts/ThemeContext";
import { peekTotalChange, subscribeTotal } from "../../../services/Feedback";
import { formatMoney } from "../Amount";
import { EASE, timing } from "../motion";
import { useCurrency } from "../../../constants/currency";

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
  useCurrency();
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
        withTiming(1, timing(MOTION.quick)),
        withDelay(2500, withTiming(2, timing(MOTION.quick, EASE.exit))),
      );
    };
    check();
    return subscribeTotal(totalKey, check);
  }, [totalKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const anim = useAnimatedStyle(() => {
    const v = t.value;
    return { opacity: v <= 1 ? v : 2 - v };
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
