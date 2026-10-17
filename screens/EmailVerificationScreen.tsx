import React, { useState, useRef, useEffect } from "react";
import { View, StyleSheet, TextInput as RNTextInput } from "react-native";
import { useRoute, RouteProp } from "@react-navigation/native";
import { SPACE, TYPE } from "../constants";
import { useTheme } from "../contexts/ThemeContext";
import { supabase } from "../services/Supabase";
import { BottomBar, Button, Page, Text } from "../components/ui";

// Define navigation params for OTP screen
type RootStackParamList = {
  OTPScreen: { email: string; name: string; phone: string };
  Main: undefined;
};

type OTPScreenRouteProp = RouteProp<RootStackParamList, "OTPScreen">;

export default function EmailVerificationScreen() {
  const { COLORS } = useTheme();
  const route = useRoute<OTPScreenRouteProp>();
  const { email } = route.params;

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string>("");
  const [valid, setValid] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [focused, setFocused] = useState<number | null>(0);

  // refs for input boxes
  const inputs = useRef<(RNTextInput | null)[]>([]);

  useEffect(() => {
    if (digits.every((d) => d !== "")) {
      setValid(true);
      setError("");
    } else if (digits.some((d) => d !== "")) {
      setValid(false);
      setError("Enter all 6 digits");
    } else {
      setValid(false);
      setError("");
    }
  }, [digits]);

  const handleOtpChange = (value: string, idx: number) => {
    if (/^\d$/.test(value)) {
      const newDigits = [...digits];
      newDigits[idx] = value;
      setDigits(newDigits);
      // focus next
      if (idx < digits.length - 1) {
        inputs.current[idx + 1]?.focus();
      }
    } else if (value === "") {
      const newDigits = [...digits];
      newDigits[idx] = "";
      setDigits(newDigits);
    }
  };

  const handleKeyPress = (
    { nativeEvent }: { nativeEvent: { key: string } },
    idx: number,
  ) => {
    if (nativeEvent.key === "Backspace" && digits[idx] === "" && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const token = digits.join("");
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
  };

  return (
    <Page
      title="Check your email"
      footer={
        <BottomBar>
          <Button title="Verify" onPress={handleVerify} disabled={!valid || loading} loading={loading} />
        </BottomBar>
      }
    >
      <Text variant="body" tone="muted">
        Enter the 6-digit code we sent to{" "}
        <Text variant="body" style={{ color: COLORS.ink }}>
          {email}
        </Text>
      </Text>

      <View style={styles.otp}>
        {digits.map((digit, idx) => {
          const active = focused === idx;
          return (
            <RNTextInput
              key={idx}
              ref={(ref) => (inputs.current[idx] = ref)}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              onFocus={() => setFocused(idx)}
              onBlur={() => setFocused((f) => (f === idx ? null : f))}
              keyboardType="number-pad"
              autoFocus={idx === 0}
              maxLength={1}
              selectionColor={COLORS.accent}
              accessibilityLabel={`Digit ${idx + 1}`}
              style={[
                TYPE.amountLarge,
                styles.cell,
                {
                  color: COLORS.ink,
                  borderBottomColor: active ? COLORS.accent : digit ? COLORS.ink : COLORS.hairline,
                },
              ]}
            />
          );
        })}
      </View>
      {error ? (
        <Text variant="callout" tone="up" align="center">
          {error}
        </Text>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  otp: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACE.sm,
    marginTop: SPACE.xxl,
    marginBottom: SPACE.lg,
  },
  cell: {
    flex: 1,
    height: 56,
    padding: 0,
    textAlign: "center",
    borderBottomWidth: 2,
  },
});
