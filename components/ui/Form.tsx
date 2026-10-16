import React, { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FONT, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text from "./Text";
import { HeaderTextButton } from "./header";
import { confirmDiscard } from "./confirm";

export interface FormRef {
  /** Leave the form without the discard prompt (call after a successful save). */
  close: () => void;
}

export interface FormProps {
  title: string;
  onSave: () => void;
  saveLabel?: string;
  canSave?: boolean;
  saving?: boolean;
  /** Unsaved changes: disables swipe-to-dismiss and asks before discarding. */
  dirty?: boolean;
  cancelLabel?: string;
  /** Replace the Save button (e.g. a multi-step form's "Next"). */
  right?: React.ReactNode;
  /** Pinned footer — a BottomBar, or a custom keypad. */
  footer?: React.ReactNode;
  /** Wrap children in a ScrollView (default). False for keypad-driven layouts. */
  scroll?: boolean;
  padded?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

const BAR = 52;

/**
 * Shell for every add/edit screen (presented as a modal sheet): Cancel ·
 * title · Save bar, scrolling body, optional pinned footer, and a guard that
 * protects unsaved work.
 */
const Form = forwardRef<FormRef, FormProps>(
  (
    {
      title,
      onSave,
      saveLabel = "Save",
      canSave = true,
      saving = false,
      dirty = false,
      cancelLabel = "Cancel",
      right,
      footer,
      scroll = true,
      padded = true,
      contentStyle,
      children,
    },
    ref,
  ) => {
    const { COLORS } = useTheme();
    const insets = useSafeAreaInsets();
    const navigation: any = useNavigation();
    const bypass = useRef(false);
    const dirtyRef = useRef(dirty);
    dirtyRef.current = dirty;

    // iOS page sheets start below the status bar; Android modals are full screen.
    const top = Platform.OS === "ios" ? 0 : insets.top;

    useImperativeHandle(ref, () => ({
      close: () => {
        bypass.current = true;
        navigation.goBack();
      },
    }));

    useLayoutEffect(() => {
      navigation.setOptions({ gestureEnabled: !dirty });
    }, [navigation, dirty]);

    useEffect(
      () =>
        navigation.addListener("beforeRemove", (e: any) => {
          if (bypass.current || !dirtyRef.current) return;
          e.preventDefault();
          confirmDiscard().then((discard) => {
            if (!discard) return;
            bypass.current = true;
            navigation.dispatch(e.data.action);
          });
        }),
      [navigation],
    );

    const scrollY = useSharedValue(0);
    const onScroll = useAnimatedScrollHandler((e) => {
      scrollY.value = e.contentOffset.y;
    });
    const hairline = useAnimatedStyle(() => ({
      opacity: interpolate(scrollY.value, [0, 8], [0, 1], Extrapolation.CLAMP),
    }));

    const body = scroll ? (
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { paddingHorizontal: padded ? SPACE.gutter : 0, paddingTop: SPACE.sm, paddingBottom: SPACE.xxl },
          contentStyle,
        ]}
      >
        {children}
      </Animated.ScrollView>
    ) : (
      <View style={[styles.flex, { paddingHorizontal: padded ? SPACE.gutter : 0 }, contentStyle]}>{children}</View>
    );

    return (
      <View style={[styles.flex, { backgroundColor: COLORS.paper, paddingTop: top }]}>
        <View style={styles.bar}>
          <View style={styles.side}>
            <HeaderTextButton label={cancelLabel} onPress={() => navigation.goBack()} />
          </View>
          <Text variant="headline" numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <View style={[styles.side, styles.right]}>
            {right ?? (
              <HeaderTextButton label={saveLabel} emphasis onPress={onSave} disabled={!canSave} loading={saving} />
            )}
          </View>
          <Animated.View style={[styles.hairline, { backgroundColor: COLORS.hairline }, hairline]} />
        </View>
        {body}
        {footer}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: {
    height: BAR,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE.gutter - SPACE.xs,
  },
  side: { minWidth: 72, flexDirection: "row", alignItems: "center" },
  right: { justifyContent: "flex-end" },
  title: { flex: 1, textAlign: "center", fontFamily: FONT.bold },
  hairline: { position: "absolute", left: 0, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
});

export default Form;
