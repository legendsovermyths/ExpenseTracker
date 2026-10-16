import React, { useState, useMemo } from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { evaluate } from "mathjs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { ColorPalette } from "../constants/theme";
import { FONT, RADIUS, SPACE, TYPE } from "../constants";
import { Icon, Pressable } from "./ui";

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
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, SPACE.md) }]}>
      {KEYS.map((row, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {row.map((key) => {
            const done = key.value === "Done";
            return (
              <Pressable
                key={key.value}
                haptic={done ? "light" : "selection"}
                accessibilityLabel={key.value === "⌫" ? "Delete" : done ? "Done" : key.label}
                style={[
                  styles.key,
                  key.type === "number" ? styles.keyNumber : styles.keyOperator,
                  done && styles.keyDone,
                ]}
                onPress={() => onKeyPress(key.value)}
              >
                {key.icon ? (
                  <Icon name={key.icon} size={done ? 24 : 22} color={done ? COLORS.paper : COLORS.ink} />
                ) : (
                  <Text
                    style={[
                      key.type === "number" ? styles.keyTextNumber : styles.keyTextOperator,
                      key.type === "action" && styles.keyTextAction,
                    ]}
                  >
                    {key.label}
                  </Text>
                )}
              </Pressable>
            );
          })}
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

  const resetExpression = (val: string = '') => setExpression(val);

  return {
    expression,
    onKeyPress,
    evaluateExpression,
    resetExpression,
  };
};

const KEY_GAP = 6;
const COLS = 5;
const KEY_WIDTH = (SCREEN_WIDTH - SPACE.lg * 2 - KEY_GAP * (COLS - 1)) / COLS;

const createStyles = (COLORS: ColorPalette) =>
  StyleSheet.create({
    container: {
      backgroundColor: COLORS.surface1,
      paddingHorizontal: SPACE.lg,
      paddingTop: SPACE.md,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
    },
    row: { flexDirection: "row", justifyContent: "center", gap: KEY_GAP, marginBottom: KEY_GAP },
    key: {
      width: KEY_WIDTH,
      height: KEY_WIDTH * 0.68,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: RADIUS.md,
    },
    keyNumber: { backgroundColor: COLORS.paper },
    keyOperator: { backgroundColor: COLORS.surface2 },
    keyDone: { backgroundColor: COLORS.accent },
    keyTextNumber: { ...TYPE.title, fontSize: 22, color: COLORS.ink },
    keyTextOperator: { ...TYPE.title, fontFamily: FONT.medium, fontSize: 20, color: COLORS.inkMuted },
    keyTextAction: { ...TYPE.headline, fontFamily: FONT.bold, color: COLORS.ink },
  });
