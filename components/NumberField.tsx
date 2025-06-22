import React, { useState, useEffect } from "react";
import { TextInput } from "react-native-paper";
import { COLORS } from "../constants";
import { DefaultTheme } from "react-native-paper";
const menuTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.gray,
    primaryContainer: COLORS.gray,
    secondaryContainer: COLORS.gray,
    surfaceVariant: COLORS.white,

    elevation: {
      ...DefaultTheme.colors.elevation,
      level2: COLORS.white,
    },
  },
};
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
      activeOutlineColor={COLORS.primary}
      theme={menuTheme}
      outlineColor={COLORS.primary}
      style={{ width, textAlign: "right", fontSize: 16 }}
      underlineStyle={{ padding: 0, margin: 0 }}
      left={prefix ? <TextInput.Affix text={prefix} /> : undefined}
      right={suffix ? <TextInput.Affix text={suffix} /> : undefined}
    />
  );
};
