import React, { forwardRef } from "react";
import { StyleProp, StyleSheet, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { RADIUS, SPACE, TYPE } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";
import Icon from "./Icon";
import Pressable from "./Pressable";

export interface SearchFieldProps extends Omit<TextInputProps, "style"> {
  value: string;
  onChangeText: (t: string) => void;
  style?: StyleProp<ViewStyle>;
}

/** iOS-style search pill: magnifier, input, clear button. */
const SearchField = forwardRef<TextInput, SearchFieldProps>(({ value, onChangeText, style, ...input }, ref) => {
  const { COLORS } = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: COLORS.surface1 }, style]}>
      <Icon name="magnify" size="md" color={COLORS.inkSubtle} />
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={COLORS.inkSubtle}
        selectionColor={COLORS.accent}
        returnKeyType="search"
        clearButtonMode="never"
        autoCorrect={false}
        {...input}
        style={[TYPE.body, styles.input, { color: COLORS.ink }]}
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChangeText("")} accessibilityLabel="Clear search" hitSlop={10}>
          <Icon name="close-circle" size="sm" color={COLORS.inkSubtle} />
        </Pressable>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.md,
    height: 40,
  },
  input: { flex: 1, padding: 0, margin: 0 },
});

export default SearchField;
