import React from "react";
import { TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Menu, Button, DefaultTheme } from "react-native-paper";
import PopupMenuStyles from "../styles/PopupMenu.styles";
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
  textColor = "black",
}) => {
  const { COLORS } = useTheme();

  const menuTheme = {
    ...DefaultTheme,
    roundness: 20,
    colors: {
      ...DefaultTheme.colors,
      elevation: {
        ...DefaultTheme.colors.elevation,
        level2: COLORS.white,
      },
    },
  };
  return (
    <TouchableOpacity onPress={onOpen}>
      <Menu
        visible={visible}
        onDismiss={onDismiss}
        theme={menuTheme}
        statusBarHeight={40}
        anchor={
          <Button onPress={onOpen} style={PopupMenuStyles.menuButtonStyle} textColor={textColor}>
            {anchorText}
          </Button>
        }
        style={PopupMenuStyles.menuStyle}
      >
        {items.map((item) => (
          <Menu.Item key={item.key} onPress={item.onPress} title={item.title} />
        ))}
      </Menu>
    </TouchableOpacity>
  );
};

export default PopupMenu;
