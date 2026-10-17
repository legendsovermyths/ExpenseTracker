import React, { useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import { Amount, Text } from "../ui";

interface Props {
  /** Horizontal centre of the bubble in chart coordinates. */
  x: number;
  chartWidth: number;
  label: string;
  /** Value in rupees. */
  value: number;
  /** Optional second line, e.g. "vs ₹1.2k last month". */
  detail?: string;
}

/** Floating value bubble above a scrubbed point, clamped inside the chart. */
const ChartTooltip: React.FC<Props> = ({ x, chartWidth, label, value, detail }) => {
  const { COLORS } = useTheme();
  const [w, setW] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);
  const left = Math.max(0, Math.min(chartWidth - w, x - w / 2));
  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      exiting={FadeOut.duration(120)}
      pointerEvents="none"
      onLayout={onLayout}
      style={[styles.bubble, { left, backgroundColor: COLORS.ink, opacity: w ? 1 : 0 }]}
    >
      <Text variant="caption" style={{ color: COLORS.paper, opacity: 0.7 }} numberOfLines={1}>
        {label}
      </Text>
      <Amount cents={Math.round(value * 100)} decimals="never" variant="headline" style={{ color: COLORS.paper }} />
      {!!detail && (
        <Text variant="caption" style={{ color: COLORS.paper, opacity: 0.7 }} numberOfLines={1}>
          {detail}
        </Text>
      )}
    </Animated.View>
  );
};

/** Vertical guideline through the scrubbed point. */
export const Guideline: React.FC<{ x: number; top: number; height: number }> = ({ x, top, height }) => {
  const { COLORS } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={[styles.guide, { left: x - StyleSheet.hairlineWidth / 2, top, height, backgroundColor: COLORS.inkSubtle }]}
    />
  );
};

const styles = StyleSheet.create({
  bubble: {
    position: "absolute",
    top: 0,
    paddingHorizontal: SPACE.sm + 2,
    paddingVertical: SPACE.xs + 1,
    borderRadius: RADIUS.sm + 2,
    zIndex: 2,
  },
  guide: { position: "absolute", width: StyleSheet.hairlineWidth * 2, opacity: 0.6 },
});

export default ChartTooltip;
