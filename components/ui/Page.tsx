import React from "react";
import { RefreshControl, ScrollView, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, { useAnimatedScrollHandler, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import LargeTitle from "./LargeTitle";
import PageBar, { BAR_HEIGHT } from "./PageBar";

export interface PageProps {
  title: string;
  subtitle?: string;
  /** Bar actions (HeaderIconButton / HeaderTextButton). */
  right?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
  /** Pinned footer, usually a BottomBar. */
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Apply the horizontal gutter to content (default true). */
  padded?: boolean;
  /** Replace the large title with a custom hero (e.g. a glyph + amount). */
  hero?: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  scrollRef?: React.RefObject<ScrollView>;
  children?: React.ReactNode;
}

/**
 * A pushed page: large title that scrolls under a compact blurred bar, back
 * chevron, optional actions and footer. Use `PageList` for long lists.
 */
const Page: React.FC<PageProps> = ({
  title,
  subtitle,
  right,
  back,
  onBack,
  footer,
  refreshing,
  onRefresh,
  padded = true,
  hero,
  contentStyle,
  scrollRef,
  children,
}) => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[styles.root, { backgroundColor: COLORS.paper }]}>
      <Animated.ScrollView
        ref={scrollRef as any}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={!!refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.inkSubtle}
              progressViewOffset={insets.top + BAR_HEIGHT}
            />
          ) : undefined
        }
        contentContainerStyle={[
          {
            paddingTop: insets.top + BAR_HEIGHT,
            paddingHorizontal: padded ? SPACE.gutter : 0,
            paddingBottom: footer ? SPACE.xl : insets.bottom + SPACE.xxl,
          },
          contentStyle,
        ]}
      >
        {hero ?? <LargeTitle title={title} subtitle={subtitle} topInset={false} gutter={!padded} />}
        {children}
      </Animated.ScrollView>
      <PageBar title={title} scrollY={scrollY} back={back} onBack={onBack} right={right} />
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({ root: { flex: 1 } });

export default Page;
