import React from "react";
import { View, Text, ViewStyle, StyleProp, TextStyle } from "react-native";

// Stable, distinct palette for initials avatars. Each name hashes (over the
// full name string, so single-word names distribute too) to one hue, kept
// consistent everywhere the person appears — Balances, ledger, split detail,
// partner picker. Mid-saturation tones: more present than a flat tint, but
// calmer than primary brights, with white initials readable on both themes.
const AVATAR_PALETTE = [
  "#3E6B85", // slate blue
  "#9A6244", // clay
  "#3F7D5F", // emerald
  "#8C4F70", // plum rose
  "#9E7636", // ochre
  "#5E4F8C", // indigo
  "#3E7E7E", // teal
];

export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

export interface AvatarProps {
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

// Colored circle with the person's initials. Color is derived from the name.
const Avatar: React.FC<AvatarProps> = ({ name, size = 38, style, textStyle }) => {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(name),
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text
        style={[
          {
            color: "#fff",
            fontSize: Math.round(size * 0.37),
            fontFamily: "Roboto-Bold",
          },
          textStyle,
        ]}
      >
        {initials(name)}
      </Text>
    </View>
  );
};

export default Avatar;
