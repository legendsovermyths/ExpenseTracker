import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { Icon } from "react-native-elements";

export interface GlyphPlateProps {
  name: string;
  type?: string;
  color: string;          // category color — drives plate tint AND icon
  size?: number;          // plate edge length
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

// GlyphPlate is the universal icon container. Plate is a low-opacity tint
// of the category color; icon strokes are the category color full strength.
// This binds icon color to category identity everywhere it appears.
const GlyphPlate: React.FC<GlyphPlateProps> = ({
  name,
  type = "material-community",
  color,
  size = 36,
  radius = 10,
  style,
}) => {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: color + "20",
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Icon name={name} type={type} size={Math.round(size * 0.55)} color={color} />
    </View>
  );
};

export default GlyphPlate;
