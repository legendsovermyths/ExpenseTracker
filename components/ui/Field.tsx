import React, { forwardRef } from "react";
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { SPACE, TYPE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Text from "./Text";
import Icon from "./Icon";

export interface FieldProps extends Omit<TextInputProps, "style"> {
  label?: string;
  icon?: string;
  error?: string | null;
  /** Trailing accessory (unit, clear button…). */
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Inline, borderless text input shaped like a ListRow so it slots into a
 * RowGroup. Label sits above the value; errors appear underneath.
 */
const Field = forwardRef<TextInput, FieldProps>(
  ({ label, icon, error, trailing, style, multiline, ...input }, ref) => {
    const { COLORS } = useTheme();
    return (
      <View style={[styles.wrap, style]}>
        <View style={styles.row}>
          {icon && <Icon name={icon} size="md" color={COLORS.inkMuted} />}
          <View style={styles.body}>
            {!!label && (
              <Text variant="caption" tone="muted" style={styles.label}>
                {label}
              </Text>
            )}
            <TextInput
              ref={ref}
              placeholderTextColor={COLORS.inkSubtle}
              selectionColor={COLORS.accent}
              multiline={multiline}
              {...input}
              style={[TYPE.headline, styles.input, { color: COLORS.ink }, multiline && styles.multiline]}
            />
          </View>
          {trailing}
        </View>
        {!!error && (
          <Text variant="caption" tone="up" style={styles.error}>
            {error}
          </Text>
        )}
      </View>
    );
  },
);

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: SPACE.lg, paddingVertical: SPACE.md, minHeight: 52, justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md },
  body: { flex: 1 },
  label: { marginBottom: 2 },
  input: { padding: 0, margin: 0 },
  multiline: { minHeight: 64, textAlignVertical: "top" },
  error: { marginTop: SPACE.xs },
});



Field.displayName = "Field";
export default Field;
