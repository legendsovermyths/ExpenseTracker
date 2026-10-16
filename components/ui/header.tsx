import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { FONT, SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text from "./Text";
import Icon from "./Icon";

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
  /** onMedia: white glyph on a dark scrim, for full-bleed photo/camera screens. */
  tone?: "accent" | "ink" | "destructive" | "onMedia";
  disabled?: boolean;
}> = ({ icon, onPress, label, tone = "accent", disabled }) => {
  const { COLORS } = useTheme();
  const color =
    tone === "destructive" ? COLORS.deltaUp : tone === "ink" ? COLORS.ink : tone === "onMedia" ? "#fff" : COLORS.accent;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={[styles.btn, tone === "onMedia" && styles.scrim]}
      haptic="light"
      disabled={disabled}
    >
      <Icon name={icon} size="lg" color={color} />
    </Pressable>
  );
};

export const HeaderActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.actions}>{children}</View>
);

const styles = StyleSheet.create({
  btn: { paddingHorizontal: SPACE.xs, paddingVertical: SPACE.xs, minWidth: 32, alignItems: "center" },
  scrim: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center" },
  actions: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});
