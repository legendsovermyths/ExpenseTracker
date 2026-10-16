import React, { useContext } from "react";
import {
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export interface ScreenProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default). Use false for FlashList screens. */
  scroll?: boolean;
  /** Apply the horizontal gutter to content. */
  padded?: boolean;
  /**
   * Add the top safe-area inset. Only for screens without a native header
   * (full-bleed, auth). Native headers handle the top themselves.
   */
  topInset?: boolean;
  /** Pinned footer — usually a BottomBar. */
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  scrollProps?: Omit<ScrollViewProps, "contentContainerStyle" | "refreshControl">;
  scrollRef?: React.Ref<ScrollView>;
}

/**
 * Base for every screen: paper background, correct insets for native
 * headers / tab bar / home indicator, and the standard gutter.
 */
const Screen: React.FC<ScreenProps> = ({
  children,
  scroll = true,
  padded = true,
  topInset = false,
  footer,
  refreshing,
  onRefresh,
  contentStyle,
  scrollProps,
  scrollRef,
}) => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const bottom = footer ? SPACE.xl : Math.max(tabBarHeight, insets.bottom) + SPACE.xl;

  const pad: ViewStyle = {
    paddingHorizontal: padded ? SPACE.gutter : 0,
    paddingTop: topInset ? insets.top : 0,
  };

  return (
    <View style={[styles.root, { backgroundColor: COLORS.paper }]}>
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          {...scrollProps}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={COLORS.inkSubtle} />
            ) : undefined
          }
          contentContainerStyle={[pad, { paddingBottom: bottom }, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.root, pad, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export default Screen;
