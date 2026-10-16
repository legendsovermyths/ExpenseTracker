import React from "react";
import { Text as RNText, TextProps as RNTextProps } from "react-native";
import { TYPE, TypeRole } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

export type Tone = "ink" | "muted" | "subtle" | "accent" | "up" | "down" | "warn" | "onAccent";

export interface TextProps extends RNTextProps {
  variant?: TypeRole;
  tone?: Tone;
  align?: "left" | "center" | "right";
}

/** Typed text: pick a type role and a tone instead of hand-rolling styles. */
const Text: React.FC<TextProps> = ({ variant = "body", tone = "ink", align, style, ...rest }) => {
  const { COLORS } = useTheme();
  const color = {
    ink: COLORS.ink,
    muted: COLORS.inkMuted,
    subtle: COLORS.inkSubtle,
    accent: COLORS.accent,
    up: COLORS.deltaUp,
    down: COLORS.deltaDown,
    warn: COLORS.warn,
    onAccent: COLORS.paper,
  }[tone];
  return <RNText {...rest} style={[TYPE[variant], { color }, align && { textAlign: align }, style]} />;
};

export default Text;
