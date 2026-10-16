import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import GlyphPlate from "../primitives/GlyphPlate";
import Text from "./Text";
import Button from "./Button";

export interface EmptyStateProps {
  icon: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, message, actionLabel, onAction, style }) => {
  const { COLORS } = useTheme();
  return (
    <View style={[styles.wrap, style]}>
      <GlyphPlate name={icon} color={COLORS.accent} size={56} radius={18} />
      <Text variant="title" align="center" style={styles.title}>
        {title}
      </Text>
      {!!message && (
        <Text variant="callout" tone="muted" align="center" style={styles.message}>
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <Button title={actionLabel} onPress={onAction} variant="secondary" style={styles.action} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: SPACE.xxxl, paddingHorizontal: SPACE.xl },
  title: { marginTop: SPACE.lg },
  message: { marginTop: SPACE.xs, maxWidth: 280 },
  action: { marginTop: SPACE.sm },
});

export default EmptyState;
