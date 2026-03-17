import React from "react";
import { TouchableOpacity, StyleProp, ViewStyle } from "react-native";
import { Menu, Button, DefaultTheme } from "react-native-paper";
import { COLORS } from "../constants";
import PopupMenuStyles from "../styles/PopupMenu.styles";
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

const PopupMenu: React.FC<PopupMenuProps> = ({
  visible,
  onDismiss,
  onOpen,
  anchorText,
  items,
  textColor = "black",
}) => {
  return (
    <TouchableOpacity onPress={onOpen}>
      <Menu
        visible={visible}
        onDismiss={onDismiss}
        theme={menuTheme}
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
