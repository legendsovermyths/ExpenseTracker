import React, { useEffect } from "react";
import { StyleProp, StyleSheet, TextInput, TextStyle } from "react-native";
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { TYPE, TypeRole } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text, { Tone } from "./Text";

export type Decimals = "auto" | "always" | "never";
export type SignMode = "none" | "auto" | "always";

/**
 * Money formatter shared by static and animated amounts. Worklet-safe
 * (no regex) so it can run on the UI thread while a value rolls.
 */
export function formatMoney(
  cents: number,
  decimals: Decimals = "auto",
  sign: SignMode = "none",
): string {
  "worklet";
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const showDec =
    decimals === "always" || (decimals === "auto" && abs % 100 !== 0);
  const whole = showDec ? Math.floor(abs / 100) : Math.round(abs / 100);
  const digits = String(whole);
  let grouped = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) grouped += ",";
    grouped += digits[i];
  }
  const dec = showDec ? "." + String(abs % 100).padStart(2, "0") : "";
  const prefix =
    sign === "none" ? "" : neg ? "−" : sign === "always" && abs > 0 ? "+" : "";
  return prefix + "₹" + grouped + dec;
}

export interface AmountProps {
  /** Value in paise/cents. */
  cents: number;
  variant?: Extract<
    TypeRole,
    | "display"
    | "amountLarge"
    | "amount"
    | "title"
    | "headline"
    | "body"
    | "callout"
    | "caption"
  >;
  tone?: Tone;
  decimals?: Decimals;
  sign?: SignMode;
  /** Roll to new values instead of jumping. */
  animated?: boolean;
  /** Animated only: value to roll up from on first mount (e.g. 0 for a new item). */
  from?: number;
  style?: StyleProp<TextStyle>;
}

Animated.addWhitelistedNativeProps({ text: true });
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

const AnimatedAmount: React.FC<
  Required<Pick<AmountProps, "cents" | "decimals" | "sign">> & {
    from?: number;
    textStyle: StyleProp<TextStyle>;
  }
> = ({ cents, from, decimals, sign, textStyle }) => {
  const value = useSharedValue(from ?? cents);
  useEffect(() => {
    value.value = withTiming(cents, {
      duration: 450,
      easing: Easing.out(Easing.cubic),
    });
  }, [cents]);
  const animatedProps = useAnimatedProps(() => {
    const text = formatMoney(value.value, decimals, sign);
    return { text, defaultValue: text } as any;
  });
  return (
    <AnimatedTextInput
      underlineColorAndroid="transparent"
      editable={false}
      pointerEvents="none"
      defaultValue={formatMoney(cents, decimals, sign)}
      animatedProps={animatedProps}
      style={[styles.input, textStyle]}
    />
  );
};

/** Formatted money in a tabular face. */
const Amount: React.FC<AmountProps> = ({
  cents,
  variant = "amount",
  tone = "ink",
  decimals = "auto",
  sign = "none",
  animated,
  from,
  style,
}) => {
  const { COLORS } = useTheme();
  if (animated) {
    const color = {
      ink: COLORS.ink,
      muted: COLORS.inkMuted,
      subtle: COLORS.inkSubtle,
      accent: COLORS.accent,
      up: COLORS.deltaUp,
      down: COLORS.deltaDown,
      warn: COLORS.warn,
      onAccent: COLORS.paper,
    }[tone];
    return (
      <AnimatedAmount
        cents={cents}
        from={from}
        decimals={decimals}
        sign={sign}
        textStyle={[TYPE[variant], { color }, style]}
      />
    );
  }
  return (
    <Text variant={variant} tone={tone} style={style} numberOfLines={1}>
      {formatMoney(cents, decimals, sign)}
    </Text>
  );
};

const styles = StyleSheet.create({ input: { padding: 0, margin: 0 } });

export default Amount;
