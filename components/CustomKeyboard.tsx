import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { COLORS } from "../constants";
import { evaluate } from "mathjs";

type CustomKeyboardProps = {
  onKeyPress: (key: string) => void;
};

export const CustomKeyboard: React.FC<CustomKeyboardProps> = ({
  onKeyPress,
}) => {
  const keys: string[] = [
    "1",
    "2",
    "3",
    "+",
    "4",
    "5",
    "6",
    "-",
    "7",
    "8",
    "9",
    "*",
    "(",
    "0",
    ")",
    "/",
    "Done",
    "",
    "C",
    ".",
  ];

  return (
    <View style={styles.keyboardContainer}>
      {keys.map((key) => (
        <TouchableOpacity
          key={key}
          style={styles.key}
          onPress={() => onKeyPress(key)}
        >
          <Text style={styles.keyText}>{key}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export const useCustomKeyboard = () => {
  const [expression, setExpression] = useState<string>("");

  const onKeyPress = (key: string): number | string => {
    if (key === "C") {
      setExpression("");
      return "";
    } else if (key === "Done") {
      const result = evaluateExpression();
      return result;
    } else {
      const result = expression + key;
      setExpression((prev) => prev + key);
      return result;
    }
  };

  const evaluateExpression = (): string => {
    if (!expression) return '0';

    try {
      const result = evaluate(expression);
      if (typeof result === "number" && !isNaN(result)) {
        setExpression(result.toString());
        return result.toString();
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

const styles = StyleSheet.create({
  keyboardContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    backgroundColor: COLORS.lightGray,
    padding: 10,
    paddingBottom: 35,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  key: {
    width: "22%",
    padding: 15,
    margin: 3,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    elevation: 5,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  keyText: {
    fontSize: 18,
    color: COLORS.primary,
  },
});
