import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  useBottomSheetDynamicSnapPoints,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text from "./Text";
import Pressable from "./Pressable";

export interface SheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface SheetProps {
  title?: string;
  /** Optional right header action (e.g. "Done"). */
  actionLabel?: string;
  onAction?: () => void;
  /** Fixed snap points for long/scrolling content; omit to size to content. */
  snapPoints?: (string | number)[];
  onDismiss?: () => void;
  children: React.ReactNode;
}

/**
 * Picker / secondary sheet that opens *over* a screen or form (category,
 * account, date, participants…). Sizes to its content unless snap points
 * are given. Requires BottomSheetModalProvider at the app root.
 */
const Sheet = forwardRef<SheetRef, SheetProps>(
  ({ title, actionLabel, onAction, snapPoints, onDismiss, children }, ref) => {
    const { COLORS } = useTheme();
    const insets = useSafeAreaInsets();
    const modal = useRef<BottomSheetModal>(null);
    const dynamic = useBottomSheetDynamicSnapPoints(useMemo(() => ["CONTENT_HEIGHT"], []));

    useImperativeHandle(ref, () => ({
      present: () => modal.current?.present(),
      dismiss: () => modal.current?.dismiss(),
    }));

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
      ),
      [],
    );

    const header = (title || actionLabel) && (
      <View style={styles.header}>
        <Text variant="title" style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {actionLabel && (
          <Pressable onPress={onAction ?? (() => modal.current?.dismiss())} haptic="light">
            <Text variant="headline" tone="accent">
              {actionLabel}
            </Text>
          </Pressable>
        )}
      </View>
    );

    const common = {
      ref: modal,
      backdropComponent: renderBackdrop,
      onDismiss,
      backgroundStyle: { backgroundColor: COLORS.surface2, borderRadius: RADIUS.xl },
      handleIndicatorStyle: { backgroundColor: COLORS.inkSubtle, width: 36 },
      keyboardBehavior: "interactive" as const,
      keyboardBlurBehavior: "restore" as const,
    };

    if (snapPoints) {
      return (
        <BottomSheetModal {...common} snapPoints={snapPoints}>
          {header}
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: SPACE.lg, paddingBottom: insets.bottom + SPACE.lg }}
          >
            {children}
          </BottomSheetScrollView>
        </BottomSheetModal>
      );
    }

    return (
      <BottomSheetModal
        {...common}
        snapPoints={dynamic.animatedSnapPoints as any}
        handleHeight={dynamic.animatedHandleHeight}
        contentHeight={dynamic.animatedContentHeight}
      >
        <BottomSheetView
          onLayout={dynamic.handleContentLayout}
          style={{ paddingHorizontal: SPACE.lg, paddingBottom: insets.bottom + SPACE.lg }}
        >
          {header}
          {children}
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACE.sm,
    marginBottom: SPACE.sm,
    gap: SPACE.md,
  },
  title: { flex: 1 },
});

export default Sheet;
