import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle } from "react-native-reanimated";
import { BlurView } from "@react-native-community/blur";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text from "./Text";
import Icon from "./Icon";

export const BAR_HEIGHT = 44;
/** Scroll distance after which the large title has gone under the bar. */
export const TITLE_COLLAPSE = 44;

export interface PageBarProps {
  title: string;
  scrollY: SharedValue<number>;
  /** Show a back chevron (default: when there's somewhere to go back to). */
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
}

/**
 * Compact top bar for pages. Transparent at rest; once the large title
 * scrolls under it, a theme-tinted blur, hairline and the compact title fade
 * in — the iOS large-title pattern, aligned to our gutter.
 */
const PageBar: React.FC<PageBarProps> = ({ title, scrollY, back, onBack, right }) => {
  const { COLORS, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const showBack = back ?? navigation.canGoBack();

  const chrome = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [TITLE_COLLAPSE - 12, TITLE_COLLAPSE], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <View pointerEvents="box-none" style={[styles.bar, { height: insets.top + BAR_HEIGHT, paddingTop: insets.top }]}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, chrome]}>
        {Platform.OS === "ios" ? (
          <>
            <BlurView
              style={StyleSheet.absoluteFill}
              blurType={isDark ? "chromeMaterialDark" : "chromeMaterialLight"}
              blurAmount={20}
            />
            <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.paper, opacity: 0.72 }]} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: COLORS.paper }]} />
        )}
        <View style={[styles.hairline, { backgroundColor: COLORS.hairline }]} />
      </Animated.View>

      <View style={styles.side}>
        {showBack && (
          <Pressable
            onPress={onBack ?? (() => navigation.goBack())}
            accessibilityLabel="Back"
            haptic="light"
            hitSlop={12}
            style={styles.back}
          >
            <Icon name="chevron-left" size={30} color={COLORS.accent} />
          </Pressable>
        )}
      </View>

      <Animated.View pointerEvents="none" style={[styles.titleWrap, chrome]}>
        <Text variant="headline" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </Animated.View>

      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.gutter - SPACE.sm,
  },
  hairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
  side: { minWidth: 72, flexDirection: "row", alignItems: "center", height: BAR_HEIGHT },
  right: { justifyContent: "flex-end", gap: SPACE.xs },
  back: { marginLeft: -SPACE.sm, padding: SPACE.xs },
  titleWrap: { flex: 1, alignItems: "center" },
  title: { fontFamily: "Satoshi-Bold" },
});

export default PageBar;
