import icons from "./icons";
import images from "./images";
import theme, { SIZES, FONTS, PRETTYCOLORS, BANKCARDTHEMES, LIGHT_COLORS, DARK_COLORS } from "./theme";

// Note: COLORS is intentionally NOT exported here.
// Components should get COLORS from useTheme() for dynamic theming.
export { icons, images, theme, SIZES, FONTS, PRETTYCOLORS, BANKCARDTHEMES, LIGHT_COLORS, DARK_COLORS };
