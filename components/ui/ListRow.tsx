import React from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { SPACE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Pressable from "./Pressable";
import Text, { Tone } from "./Text";
import Icon from "./Icon";
import GlyphPlate from "../primitives/GlyphPlate";

export interface ListRowProps {
  title: string;
  subtitle?: string;
  /** Leading element — Avatar, GlyphPlate, image… Takes priority over `icon`. */
  leading?: React.ReactNode;
  /** Shorthand leading glyph plate in the accent (or `iconColor`). */
  icon?: string;
  iconColor?: string;
  /** Plain trailing text value (e.g. a selected option). */
  value?: string;
  valueTone?: Tone;
  /** Custom trailing element — Amount, Switch, badge… */
  trailing?: React.ReactNode;
  chevron?: boolean;
  destructive?: boolean;
  /** Placeholder style for empty form values. */
  placeholder?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  /** Tighter vertical rhythm for dense lists. */
  dense?: boolean;
  /** Horizontal padding; 0 when the row sits directly on paper inside a gutter. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** The universal row: leading · title/subtitle · trailing. */
const ListRow: React.FC<ListRowProps> = ({
  title,
  subtitle,
  leading,
  icon,
  iconColor,
  value,
  valueTone = "muted",
  trailing,
  chevron,
  destructive,
  placeholder,
  onPress,
  onLongPress,
  disabled,
  dense,
  padded = true,
  style,
}) => {
  const { COLORS } = useTheme();
  const lead =
    leading ??
    (icon ? (
      <GlyphPlate name={icon} color={destructive ? COLORS.deltaUp : iconColor ?? COLORS.accent} size={34} radius={10} />
    ) : null);

  const body = (
    <View
      style={[
        styles.row,
        { paddingVertical: dense ? SPACE.sm + 2 : SPACE.md, paddingHorizontal: padded ? SPACE.lg : 0 },
        style,
      ]}
    >
      {lead}
      <View style={styles.text}>
        <Text
          variant="headline"
          tone={destructive ? "up" : placeholder ? "subtle" : "ink"}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text variant="callout" tone="muted" numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>
      {value != null && (
        <Text variant="body" tone={valueTone} numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      )}
      {trailing}
      {chevron && <Icon name="chevron-right" size="md" color={COLORS.inkSubtle} />}
    </View>
  );

  if (!onPress && !onLongPress) return body;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} disabled={disabled} scale={false}>
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACE.md, minHeight: 52 },
  text: { flex: 1, minWidth: 0 },
  subtitle: { marginTop: 2 },
  value: { maxWidth: "45%", textAlign: "right" },
});

export default ListRow;
