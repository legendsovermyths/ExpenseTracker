import React, { useRef, useState, useCallback } from "react";
import { View, LayoutRectangle } from "react-native";
import { TextInput, Menu, DefaultTheme } from "react-native-paper";
import { COLORS } from "../constants";
import DescriptionInputStyles from "../styles/DescriptionInput.styles";

type Props = {
  value: string;
  onChangeValue: (text: string) => void;
  label: string;
  suggestions: string[];
  onPickSuggestion?: (text: string) => void;
  onFocus?: () => void;
};

const menuTheme = {
  ...DefaultTheme,
  roundness: 20,
  colors: {
    ...DefaultTheme.colors,
    elevation: { ...DefaultTheme.colors.elevation, level2: COLORS.white },
  },
};

const DescriptionAutocompleteInput: React.FC<Props> = ({
  value,
  onChangeValue,
  label,
  suggestions,
  onPickSuggestion,
  onFocus,
}) => {
  const [menuVisible, setMenuVisible] = useState(false);
  const [anchor, setAnchor] = useState<{ x: number; y: number } | undefined>({ x: 30, y: 210  });
  const inputRef = useRef<any>(null); 

  const closeMenu = () => setMenuVisible(false);

  const maybeOpenMenu = useCallback(
    (text: string) => {
      const hasMatches =
        text.length > 0 &&
        suggestions.some((s) =>
          s.toLowerCase().startsWith(text.toLowerCase()),
        );
      setMenuVisible(hasMatches);
    },
    [suggestions],
  );

  const handleChange = (text: string) => {
    onChangeValue(text);
    maybeOpenMenu(text);
  };

  const handlePick = (text: string) => {
    onChangeValue(text);
    onPickSuggestion?.(text);
    closeMenu();
  };


  const filtered = suggestions
    .filter((s) => s.toLowerCase().startsWith(value.toLowerCase()))
    .slice(0, 6); 

  return (
    <View>
      <TextInput
        ref={inputRef}
        mode="outlined"
        outlineColor={COLORS.primary}
        activeOutlineColor={COLORS.primary}
        label={label}
        value={value}
        onFocus={onFocus}
        onChangeText={handleChange}
        style={DescriptionInputStyles.input}
        theme={{ roundness: 30 }}
      />

      <Menu
        visible={menuVisible}
        onDismiss={closeMenu}
        anchor={anchor ?? { x: 0, y: 0 }}
        theme={menuTheme}
        style={{ width: "85%" }} // matches TextInput width in most layouts
      >
        {filtered.map((s) => (
          <Menu.Item key={s} title={s} onPress={() => handlePick(s)} />
        ))}
      </Menu>
    </View>
  );
};

export default DescriptionAutocompleteInput;
