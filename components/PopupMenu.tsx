import React, { useMemo } from "react";
import { TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Menu, Button } from "react-native-paper";
import { createStyles } from "../styles/PopupMenu.styles";
import { useTheme } from "../contexts/ThemeContext";
type PopupMenuProps = {
  visible: boolean;
  onDismiss: () => void;
  onOpen: () => void;
  anchorText: string;
  items: { key: string; title: string; onPress: () => void }[];
  menuStyle?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
  textColor?: string;
};

const PopupMenu: React.FC<PopupMenuProps> = ({
  visible,
  onDismiss,
  onOpen,
  anchorText,
  items,
  textColor,
}) => {
  const { COLORS, paperTheme } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const resolvedTextColor = textColor || COLORS.ink;

  const menuTheme = useMemo(() => ({
    ...paperTheme,
    roundness: 20,
    colors: {
      ...paperTheme.colors,
      onSurface: COLORS.ink,
      elevation: {
        ...paperTheme.colors.elevation,
        level2: COLORS.paper,
      },
    },
  }), [COLORS, paperTheme]);

  return (
    <TouchableOpacity onPress={onOpen}>
      <Menu
        visible={visible}
        onDismiss={onDismiss}
        theme={menuTheme}
        statusBarHeight={40}
        anchor={
          <Button onPress={onOpen} style={styles.menuButtonStyle} textColor={resolvedTextColor}>
            {anchorText}
          </Button>
        }
        style={styles.menuStyle}
      >
        {items.map((item) => (
          <Menu.Item
            key={item.key}
            onPress={item.onPress}
            title={item.title}
            titleStyle={{ color: COLORS.ink }}
          />
        ))}
      </Menu>
    </TouchableOpacity>
  );
};

export default PopupMenu;
