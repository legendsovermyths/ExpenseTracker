import React from "react";
import { StyleSheet, View, ViewProps, ViewStyle, StyleProp } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";

export interface SurfaceProps extends ViewProps {
  tier?: 1 | 2;
  bordered?: boolean;
  radius?: number;
  padding?: number;
  style?: StyleProp<ViewStyle>;
}

// Surface is the base material for cards, list rows, and elevated blocks.
// Tier 1 = inline content on paper. Tier 2 = elevated card with a hairline.
const Surface: React.FC<SurfaceProps> = ({
  tier = 2,
  bordered,
  radius = 16,
  padding,
  style,
  children,
  ...rest
}) => {
  const { COLORS } = useTheme();
  const showBorder = bordered ?? tier === 2;
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: tier === 2 ? COLORS.surface2 : COLORS.surface1,
          borderRadius: radius,
          ...(padding != null ? { padding } : null),
          ...(showBorder
            ? { borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.hairline }
            : null),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
};

export default Surface;
