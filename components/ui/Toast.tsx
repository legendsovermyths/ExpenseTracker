import React, { useCallback, useEffect, useRef, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { FullWindowOverlay } from "react-native-screens";
import Animated, { FadeOutUp, SlideInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text from "./Text";
import Icon from "./Icon";
import { haptic } from "./haptics";

export type ToastKind = "success" | "error" | "info";

interface ToastState {
  id: number;
  message: string;
  kind: ToastKind;
}

type Listener = (t: ToastState) => void;
let listener: Listener | null = null;
let seq = 0;

/** Show a short confirmation from anywhere (screens, services). */
export const toast = (message: string, kind: ToastKind = "success") => {
  haptic(kind === "error" ? "error" : kind === "success" ? "success" : "light");
  listener?.({ id: ++seq, message, kind });
};

const DURATION = 2200;

/** Mount once near the app root (inside SafeAreaProvider + ThemeProvider). */
export const ToastHost: React.FC = () => {
  const { COLORS } = useTheme();
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((t: ToastState) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(t);
    timer.current = setTimeout(() => setCurrent(null), DURATION);
  }, []);

  useEffect(() => {
    listener = show;
    return () => {
      listener = null;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [show]);

  if (!current) return null;
  const icon =
    current.kind === "success"
      ? "check-circle"
      : current.kind === "error"
        ? "alert-circle"
        : "information";
  const iconColor =
    current.kind === "success"
      ? COLORS.deltaDown
      : current.kind === "error"
        ? COLORS.deltaUp
        : COLORS.accent;

  // FullWindowOverlay keeps the toast above native modals on iOS.
  const Overlay = Platform.OS === "ios" ? FullWindowOverlay : React.Fragment;

  return (
    <Overlay>
      <View
        pointerEvents="none"
        style={[styles.host, { top: insets.top + SPACE.sm }]}
      >
        <Animated.View
          key={current.id}
          entering={SlideInUp.springify().damping(18)}
          exiting={FadeOutUp.duration(180)}
          style={[
            styles.toast,
            { backgroundColor: COLORS.surface2, borderColor: COLORS.hairline },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Icon name={icon} size="md" color={iconColor} />
          <Text variant="headline" numberOfLines={2} style={styles.text}>
            {current.message}
          </Text>
        </Animated.View>
      </View>
    </Overlay>
  );
};

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: SPACE.lg,
    right: SPACE.lg,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.md,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: "100%",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  text: { flexShrink: 1 },
});
