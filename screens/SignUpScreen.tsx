import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, TextInput } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { SPACE } from "../constants";
import { supabase } from "../services/Supabase";
import { BottomBar, Button, Field, Page, RowGroup, Text } from "../components/ui";

const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

export default function SignUpScreen() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState("");
  const passwordRef = useRef<TextInput>(null);

  const route: any = useRoute();
  const navigation: any = useNavigation();
  const { name, phone } = route.params;


  useEffect(() => {
    let eErr = "";
    if (email && !EMAIL_REGEX.test(email)) {
      eErr = "Enter a valid email address";
    }
    setEmailError(eErr);

    let pErr = "";
    if (password && password.length < 6) {
      pErr = "Password must be at least 6 characters";
    }
    setPasswordError(pErr);

    setValid(EMAIL_REGEX.test(email) && password.length >= 6);
  }, [email, password]);

  const handleContinue = async () => {
    setLoading(true);
    setSupabaseError("");
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone },
      },
    });
    setLoading(false);
    if (error) {
      setSupabaseError(error.message);
      return;
    }
    navigation.navigate("OTPScreen", { name, phone, email });
  };

  return (
    <Page
      title="Create account"
      footer={
        <BottomBar>
          <Button title="Continue" onPress={handleContinue} disabled={!valid || loading} loading={loading} />
        </BottomBar>
      }
    >
      <Text variant="body" tone="muted" style={styles.lead}>
        Sign up with your email and a password.
      </Text>

      <RowGroup>
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          error={emailError}
        />
        <Field
          ref={passwordRef}
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder="At least 6 characters"
          error={passwordError}
        />
      </RowGroup>
      {supabaseError ? (
        <Text variant="callout" tone="up" style={styles.error}>
          {supabaseError}
        </Text>
      ) : null}
    </Page>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: SPACE.xl },
  error: { marginTop: SPACE.sm, paddingHorizontal: SPACE.lg },
});
