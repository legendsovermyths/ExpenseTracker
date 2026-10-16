import React, { useEffect, useLayoutEffect, useRef } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { FONT, SPACE } from "../../constants";
import { ColorPalette } from "../../constants/theme";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text from "./Text";
import Icon from "./Icon";
import { confirmDiscard } from "./confirm";

// ── Option builders (used by the navigator) ──────────────────────────

/** Native iOS page header: large title that collapses with blur on scroll. */
export const pageHeaderOptions = (
  COLORS: ColorPalette,
  isDark: boolean,
  { large = true }: { large?: boolean } = {},
): NativeStackNavigationOptions => ({
  headerShown: true,
  headerLargeTitle: large,
  headerTransparent: Platform.OS === "ios",
  headerBlurEffect: isDark ? "systemChromeMaterialDark" : "systemChromeMaterialLight",
  headerLargeStyle: { backgroundColor: COLORS.paper },
  headerLargeTitleShadowVisible: false,
  headerStyle: Platform.OS === "ios" ? undefined : { backgroundColor: COLORS.paper },
  headerShadowVisible: Platform.OS === "ios",
  headerTintColor: COLORS.accent,
  headerTitleStyle: { fontFamily: FONT.bold, fontSize: 17, color: COLORS.ink },
  headerLargeTitleStyle: { fontFamily: FONT.bold, fontSize: 32, color: COLORS.ink },
  headerBackTitleVisible: false,
  contentStyle: { backgroundColor: COLORS.paper },
});

/** Native modal header for forms: Cancel · title · Save. */
export const formHeaderOptions = (COLORS: ColorPalette, isDark: boolean): NativeStackNavigationOptions => ({
  ...pageHeaderOptions(COLORS, isDark, { large: false }),
  headerTransparent: false,
  headerStyle: { backgroundColor: COLORS.paper },
  headerShadowVisible: false,
});

// ── Header buttons ───────────────────────────────────────────────────

export const HeaderTextButton: React.FC<{
  label: string;
  onPress: () => void;
  emphasis?: boolean;
  disabled?: boolean;
  loading?: boolean;
}> = ({ label, onPress, emphasis, disabled, loading }) => {
  const { COLORS } = useTheme();
  if (loading) return <ActivityIndicator color={COLORS.accent} style={styles.btn} />;
  return (
    <Pressable onPress={onPress} disabled={disabled} haptic={emphasis ? "light" : undefined} style={styles.btn}>
      <Text variant="headline" tone="accent" style={emphasis && { fontFamily: FONT.bold }}>
        {label}
      </Text>
    </Pressable>
  );
};

export const HeaderIconButton: React.FC<{
  icon: string;
  onPress: () => void;
  label: string;
  tone?: "accent" | "destructive";
}> = ({ icon, onPress, label, tone = "accent" }) => {
  const { COLORS } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityLabel={label} style={styles.btn} haptic="light">
      <Icon name={icon} size="lg" color={tone === "destructive" ? COLORS.deltaUp : COLORS.accent} />
    </Pressable>
  );
};

export const HeaderActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.actions}>{children}</View>
);

// ── Hooks used inside screens ────────────────────────────────────────

/** Set the page title and optional right-side actions. */
export const usePageHeader = (title: string, right?: () => React.ReactNode, deps: unknown[] = []) => {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ title, headerRight: right } as any);
  }, [navigation, title, ...deps]);
};

export interface FormHeaderConfig {
  title: string;
  onSave: () => void;
  saveLabel?: string;
  canSave?: boolean;
  saving?: boolean;
  /** Unsaved changes: blocks swipe-to-dismiss and asks before discarding. */
  dirty?: boolean;
  cancelLabel?: string;
}

/**
 * Wires the native form header (Cancel / title / Save) and the dirty guard.
 * Call the returned `close()` after a successful save to leave without the
 * discard prompt.
 */
export const useFormHeader = ({
  title,
  onSave,
  saveLabel = "Save",
  canSave = true,
  saving = false,
  dirty = false,
  cancelLabel = "Cancel",
}: FormHeaderConfig) => {
  const navigation: any = useNavigation();
  const bypass = useRef(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useLayoutEffect(() => {
    navigation.setOptions({
      title,
      gestureEnabled: !dirty,
      headerLeft: () => <HeaderTextButton label={cancelLabel} onPress={() => navigation.goBack()} />,
      headerRight: () => (
        <HeaderTextButton label={saveLabel} emphasis onPress={onSave} disabled={!canSave} loading={saving} />
      ),
    });
  }, [navigation, title, saveLabel, canSave, saving, dirty, onSave, cancelLabel]);

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (e: any) => {
        if (bypass.current || !dirtyRef.current) return;
        e.preventDefault();
        confirmDiscard().then((discard) => discard && navigation.dispatch(e.data.action));
      }),
    [navigation],
  );

  return {
    close: () => {
      bypass.current = true;
      navigation.goBack();
    },
  };
};

const styles = StyleSheet.create({
  btn: { paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xs, minWidth: 32, alignItems: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
