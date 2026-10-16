import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { RADIUS, SPACE, TYPE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text from "./Text";
import Icon from "./Icon";
import { HapticKind } from "./haptics";

export type ButtonVariant = "primary" | "secondary" | "destructive";

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  /** Primary buttons are full-width by default. */
  fullWidth?: boolean;
  haptic?: HapticKind;
  style?: StyleProp<ViewStyle>;
}

/**
 * Three variants, one shape:
 * - primary: filled accent, 52pt, the one main action on a screen
 * - secondary: accent text, for the alternative action
 * - destructive: red text, never filled
 */
const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  icon,
  loading,
  disabled,
  fullWidth = variant === "primary",
  haptic,
  style,
}) => {
  const { COLORS } = useTheme();
  const filled = variant === "primary";
  const fg = filled ? COLORS.paper : variant === "destructive" ? COLORS.deltaUp : COLORS.accent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      haptic={haptic ?? (variant === "destructive" ? "warning" : "light")}
      accessibilityLabel={title}
      style={[
        styles.base,
        filled && { backgroundColor: COLORS.accent },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.content}>
          {icon && <Icon name={icon} size="md" color={fg} />}
          <Text style={[TYPE.headline, { fontFamily: TYPE.title.fontFamily, color: fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACE.xl,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: { alignSelf: "stretch" },
  content: { flexDirection: "row", alignItems: "center", gap: SPACE.sm },
});

export default Button;
