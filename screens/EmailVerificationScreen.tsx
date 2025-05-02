import React, { useState, useRef, useEffect } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TextInput as RNTextInput,
} from "react-native";
import { Button, Text } from "react-native-paper";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { COLORS, FONTS, SIZES } from "../constants";
import { supabase } from "../services/Supabase";

// Define navigation params for OTP screen
type RootStackParamList = {
  OTPScreen: { email: string; name: string; phone: string };
  Main: undefined;
};

type OTPScreenRouteProp = RouteProp<RootStackParamList, "OTPScreen">;

export default function EmailVerificationScreen() {
  const navigation: any = useNavigation();
  const route = useRoute<OTPScreenRouteProp>();
  const { email, name, phone } = route.params;

  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [error, setError] = useState<string>("");
  const [valid, setValid] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

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
    const { data, error } = await supabase.auth.verifyOtp({
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Almost there!</Text>
        <Text style={styles.subtitle}>
          Enter the 6-digit code we sent to{" "}
          <Text style={styles.highlight}>{email}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {digits.map((digit, idx) => (
            <RNTextInput
              key={idx}
              ref={(ref) => (inputs.current[idx] = ref)}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, idx)}
              onKeyPress={(e) => handleKeyPress(e, idx)}
              keyboardType="number-pad"
              maxLength={1}
              style={styles.otpBox}
            />
          ))}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          mode="contained"
          onPress={handleVerify}
          disabled={!valid || loading}
          loading={loading}
          contentStyle={styles.buttonContent}
          style={[
            styles.button,
            valid && !loading
              ? { backgroundColor: COLORS.primary }
              : { backgroundColor: COLORS.lightGray },
          ]}
          labelStyle={{ ...FONTS.h3, color: COLORS.white }}
        >
          {loading ? "Verifying..." : "Continue"}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: "center",
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SIZES.padding * 1.1,
    elevation: 3,
  },
  title: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
  subtitle: {
    ...FONTS.body4,
    color: COLORS.darkgray,
    marginTop: SIZES.base,
  },
  highlight: {
    ...FONTS.body4,
    color: COLORS.primary,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: SIZES.padding,
  },
  otpBox: {
    width: 50,
    height: 50,
    borderWidth: 1,
    borderColor: COLORS.darkgray,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 24,
    marginHorizontal: SIZES.base / 2,
  },
  errorText: {
    ...FONTS.body4,
    color: COLORS.red2,
    marginTop: SIZES.base / 2,
    textAlign: "center",
  },
  buttonContent: {
    height: 50,
  },
  button: {
    marginTop: SIZES.padding,
    borderRadius: 10,
  },
});
