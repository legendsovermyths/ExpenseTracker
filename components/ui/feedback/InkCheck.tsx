import React, { useEffect } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { MOTION } from "../../../constants";
import { EASE, timing } from "../motion";

const APath = Animated.createAnimatedComponent(Path);
const LEN = 10;

export interface InkCheckProps {
  /** Draws the stroke when true, clears it when false. */
  drawn: boolean;
  /** Badge diameter; the check scales with it. */
  size?: number;
  color: string;
  /** Fill behind the check. Omit for a bare check. */
  background?: string;
  /** Start already drawn, without animating (e.g. restored state). */
  instant?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * The app's one flourish: a confirmation is written, not popped. The badge
 * fades in, then a short pen stroke draws the ✓. No scale, no bounce.
 */
const InkCheck: React.FC<InkCheckProps> = ({
  drawn,
  size = 14,
  color,
  background,
  instant,
  style,
}) => {
  const start = drawn && instant ? 1 : 0;
  const fill = useSharedValue(start);
  const stroke = useSharedValue(start);

  useEffect(() => {
    if (drawn) {
      fill.value = withTiming(1, timing(MOTION.quick));
      stroke.value = withDelay(
        background ? MOTION.quick / 2 : 0,
        withTiming(1, timing(MOTION.ink, EASE.ink)),
      );
    } else {
      fill.value = withTiming(0, timing(MOTION.quick, EASE.exit));
      stroke.value = withTiming(0, timing(MOTION.quick, EASE.exit));
    }
  }, [drawn]); // eslint-disable-line react-hooks/exhaustive-deps

  const badge = useAnimatedStyle(() => ({ opacity: fill.value }));
  const check = useAnimatedProps(() => ({
    strokeDashoffset: LEN * (1 - stroke.value),
  }));
  const glyph = background ? size * 0.7 : size;

  return (
    <View style={[{ width: size, height: size }, styles.center, style]}>
      {background && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { borderRadius: size / 2, backgroundColor: background },
            badge,
          ]}
        />
      )}
      <Svg width={glyph} height={glyph} viewBox="0 0 10 10">
        <APath
          d="M2 5.2 L4.2 7.3 L8 3"
          stroke={color}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={LEN}
          animatedProps={check}
        />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});

export default InkCheck;
