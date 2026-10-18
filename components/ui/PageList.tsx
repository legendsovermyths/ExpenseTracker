import React from "react";
import { RefreshControl, StyleSheet, View } from "react-native";
import { FlashList, FlashListProps } from "@shopify/flash-list";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import LargeTitle from "./LargeTitle";
import PageBar, { BAR_HEIGHT } from "./PageBar";

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList as any,
) as any;

export interface PageListChrome {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
  footer?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Content between the large title and the first row (search, summary…). */
  header?: React.ReactNode;
  /** Handle to the underlying FlashList (e.g. for layout animations). */
  listRef?: React.Ref<any>;
}

export type PageListProps<T> = PageListChrome &
  Omit<
    FlashListProps<T>,
    | "ListHeaderComponent"
    | "refreshControl"
    | "onScroll"
    | "refreshing"
    | "onRefresh"
  >;

/**
 * Page chrome around a FlashList. Rows are full-bleed — give each row the
 * gutter itself (`ListRow` does by default). Avoid sticky headers here: they
 * would stick under the bar.
 */
function PageList<T>({
  title,
  subtitle,
  right,
  back,
  onBack,
  footer,
  refreshing,
  onRefresh,
  header,
  listRef,
  contentContainerStyle,
  ...list
}: PageListProps<T>) {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[styles.root, { backgroundColor: COLORS.paper }]}>
      <AnimatedFlashList
        {...list}
        ref={listRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
        ListHeaderComponent={
          <>
            <LargeTitle title={title} subtitle={subtitle} topInset={false} />
            {header}
          </>
        }
        contentContainerStyle={{
          paddingTop: insets.top + BAR_HEIGHT,
          paddingBottom: footer ? SPACE.xl : insets.bottom + SPACE.xxl,
          ...(contentContainerStyle as object),
        }}
      />
      <PageBar
        title={title}
        scrollY={scrollY}
        back={back}
        onBack={onBack}
        right={right}
      />
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });

export default PageList;
