import React from "react";
import Svg, { Path } from "react-native-svg";
import { Icon } from "react-native-elements";
import { useExpensifyStore } from "../../store/store";

export interface CustomGlyphProps {
  /** Icon id (the `icon_name` of a "custom" icon). */
  id: string;
  size: number;
  color: string;
  /** Path to draw directly, e.g. an unsaved preview. Overrides `id`. */
  path?: string;
}

/**
 * An AI-generated icon. Paths live on the same 24×24 grid (2-unit margin)
 * as Material icons, so at the same size it sits exactly like a font glyph.
 * Until a shared icon has synced, a neutral shape stands in.
 */
const CustomGlyph: React.FC<CustomGlyphProps> = ({ id, size, color, path }) => {
  const stored = useExpensifyStore((s) => s.customIcons[id]?.path);
  const d = path ?? stored;
  if (!d) {
    return (
      <Icon
        name="shape-outline"
        type="material-community"
        size={size}
        color={color}
      />
    );
  }
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityRole="image"
    >
      <Path d={d} fill={color} fillRule="evenodd" />
    </Svg>
  );
};

export default React.memo(CustomGlyph);
