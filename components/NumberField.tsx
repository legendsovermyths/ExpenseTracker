import React, { useState, useEffect, useMemo } from "react";
import { TextInput } from "react-native-paper";
import { useTheme } from "../contexts/ThemeContext";

interface Props {
  value: number; // canonical numeric value
  onChange: (n: number) => void; // push numeric value up
  width?: number; // pass-through styling
  prefix?: string;
  suffix?: string;
}

export const NumberField: React.FC<Props> = ({
  value,
  onChange,
  width = 160,
  prefix = "",
  suffix = "",
}) => {
  const { COLORS, paperTheme } = useTheme();
  const menuTheme = useMemo(() => ({
    ...paperTheme,
    colors: {
      ...paperTheme.colors,
      primary: COLORS.ink,
      secondary: COLORS.hairline,
      primaryContainer: COLORS.hairline,
      secondaryContainer: COLORS.hairline,
      surfaceVariant: COLORS.paper,
      elevation: {
        ...paperTheme.colors.elevation,
        level2: COLORS.paper,
      },
    },
  }), [COLORS, paperTheme]);

  // keep what the user actually typed
  const [text, setText] = useState(value.toString());

  useEffect(() => setText(value.toString()), [value]);

  const handleChange = (t: string) => {
    if (/^(\d+)?(\.\d*)?$/.test(t)) {
      setText(t);
      const num = parseFloat(t);
      if (!Number.isNaN(num)) onChange(num);
    }
  };

  return (
    <TextInput
      keyboardType="decimal-pad"
      value={text}
      onChangeText={handleChange}
      activeOutlineColor={COLORS.ink}
      theme={menuTheme}
      outlineColor={COLORS.ink}
      style={{ width, textAlign: "right", fontSize: 16 }}
      underlineStyle={{ padding: 0, margin: 0 }}
      textColor={COLORS.ink}
      left={prefix ? <TextInput.Affix text={prefix} textStyle={{ color: COLORS.inkMuted }} /> : undefined}
      right={suffix ? <TextInput.Affix text={suffix} textStyle={{ color: COLORS.inkMuted }} /> : undefined}
    />
  );
};
