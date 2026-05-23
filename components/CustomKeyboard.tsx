import React, { useState, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import { evaluate } from "mathjs";
import { Icon } from "react-native-elements";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { FONTS, SIZES } from "../constants";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type CustomKeyboardProps = {
  onKeyPress: (key: string) => void;
};

type KeyType = "number" | "operator" | "action";

interface KeyDef {
  label: string;
  value: string;
  type: KeyType;
  icon?: string;
}

const KEYS: KeyDef[][] = [
  [
    { label: "1", value: "1", type: "number" },
    { label: "2", value: "2", type: "number" },
    { label: "3", value: "3", type: "number" },
    { label: "+", value: "+", type: "operator" },
    { label: "(", value: "(", type: "operator" },
  ],
  [
    { label: "4", value: "4", type: "number" },
    { label: "5", value: "5", type: "number" },
    { label: "6", value: "6", type: "number" },
    { label: "−", value: "-", type: "operator" },
    { label: ")", value: ")", type: "operator" },
  ],
  [
    { label: "7", value: "7", type: "number" },
    { label: "8", value: "8", type: "number" },
    { label: "9", value: "9", type: "number" },
    { label: "×", value: "*", type: "operator" },
    { label: "÷", value: "/", type: "operator" },
  ],
  [
    { label: ".", value: ".", type: "number" },
    { label: "0", value: "0", type: "number" },
    { label: "", value: "⌫", type: "action", icon: "backspace-outline" },
    { label: "C", value: "C", type: "action" },
    { label: "", value: "Done", type: "action", icon: "check" },
  ],
];

export const CustomKeyboard: React.FC<CustomKeyboardProps> = ({ onKeyPress }) => {
  const { COLORS } = useTheme();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.container}>
      <View style={styles.dividerBar} />
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((key) => (
            <TouchableOpacity
              key={key.value}
              style={[
                styles.key,
                key.type === "number" && styles.keyNumber,
                key.type === "operator" && styles.keyOperator,
                key.type === "action" && styles.keyAction,
                key.value === "Done" && styles.keyDone,
              ]}
              onPress={() => onKeyPress(key.value)}
              activeOpacity={0.6}
            >
              {key.icon ? (
                <Icon
                  name={key.icon}
                  type="material-community"
                  size={key.value === "Done" ? 22 : 20}
                  color={key.value === "Done" ? COLORS.white : COLORS.primary}
                />
              ) : (
                <Text
                  style={[
                    styles.keyText,
                    key.type === "number" && styles.keyTextNumber,
                    key.type === "operator" && styles.keyTextOperator,
                    key.type === "action" && styles.keyTextAction,
                  ]}
                >
                  {key.label}
                </Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ))}
    </View>
  );
};

export const useCustomKeyboard = (initialExpression?: string) => {
  const [expression, setExpression] = useState<string>(initialExpression || "");

  const onKeyPress = (key: string): number | string => {
    if (key === "C") {
      setExpression("");
      return "";
    } else if (key === "Done") {
      const result = evaluateExpression();
      return result;
    } else if (key === "⌫") {
      const result = expression.slice(0, -1);
      setExpression(result);
      return result;
    } else {
      const result = expression + key;
      setExpression((prev) => prev + key);
      return result;
    }
  };

  const evaluateExpression = (): string => {
    if (!expression) return "0";
    try {
      const result = evaluate(expression);
      if (typeof result === "number" && !isNaN(result)) {
        // Round to 2 decimal places to avoid floating point noise
        const rounded = Math.round(result * 100) / 100;
        const str = rounded % 1 === 0 ? rounded.toString() : rounded.toFixed(2);
        setExpression(str);
        return str;
      } else {
        throw new Error("Invalid expression");
      }
    } catch (error) {
      return "Error";
    }
  };

  return {
    expression,
    onKeyPress,
    evaluateExpression,
  };
};

const KEY_GAP = 6;
const COLS = 5;
const PADDING_H = SIZES.padding;
const KEY_WIDTH = (SCREEN_WIDTH - PADDING_H * 2 - KEY_GAP * (COLS - 1)) / COLS;

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      backgroundColor: COLORS.lightGray,
      paddingHorizontal: PADDING_H,
      paddingTop: SIZES.base,
      paddingBottom: SIZES.padding + 10,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
    },
    dividerBar: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: COLORS.gray,
      alignSelf: "center",
      marginBottom: SIZES.base + 2,
      opacity: 0.4,
    },
    row: {
      flexDirection: "row",
      justifyContent: "center",
      gap: KEY_GAP,
      marginBottom: KEY_GAP,
    },
    key: {
      width: KEY_WIDTH,
      height: KEY_WIDTH * 0.65,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 12,
    },

    // Number keys — white background
    keyNumber: {
      backgroundColor: COLORS.white,
    },
    keyTextNumber: {
      ...FONTS.body2,
      fontSize: 20,
      fontWeight: "600",
      color: COLORS.primary,
    },

    // Operator keys — subtle tinted background
    keyOperator: {
      backgroundColor: COLORS.lightGray2,
    },
    keyTextOperator: {
      fontSize: 20,
      fontWeight: "500",
      color: COLORS.darkgray,
    },

    // Action keys — transparent with text
    keyAction: {
      backgroundColor: COLORS.lightGray2,
    },
    keyTextAction: {
      ...FONTS.body3,
      fontSize: 16,
      fontWeight: "600",
      color: COLORS.primary,
    },

    // Done key — primary filled
    keyDone: {
      backgroundColor: COLORS.primary,
    },

    keyText: {
      fontSize: 18,
      color: COLORS.primary,
    },
  });
