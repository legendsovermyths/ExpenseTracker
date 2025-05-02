import React, { useState, useEffect } from "react";
import { View, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from "react-native";
import { TextInput, Button, Text } from "react-native-paper";
import { useNavigation, useRoute } from "@react-navigation/native";
import { COLORS, FONTS, SIZES } from "../constants";

export default function ProfileScreen() {
  const navigation: any = useNavigation();

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [valid, setValid] = useState(false);

  const PHONE_REGEX = /^\+\d{10,15}$/;

  useEffect(() => {
    let nErr = "";
    if (name.length > 0 && name.trim().length < 2) {
      nErr = "Name must be at least 2 characters";
    }
    setNameError(nErr);

    let pErr = "";
    if (phone.length > 0 && !PHONE_REGEX.test(phone)) {
      pErr = "Use format +[country][number], e.g. +11234567890";
    }
    setPhoneError(pErr);

    setValid(name.trim().length >= 2 && PHONE_REGEX.test(phone));
  }, [name, phone]);

  const handleContinue = () => {
    navigation.navigate("SignUp", { name: name, phone: phone });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>Enter your name and phone number</Text>

        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          style={styles.input}
          outlineColor={COLORS.lightGray}
          activeOutlineColor={COLORS.primary}
          placeholder="John Doe"
        />
        {nameError ? <Text style={styles.errorText}>{nameError}</Text> : null}

        <TextInput
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          mode="outlined"
          style={styles.input}
          outlineColor={COLORS.lightGray}
          activeOutlineColor={COLORS.primary}
          placeholder="+11234567890"
        />
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

        <Button
          mode="contained"
          onPress={handleContinue}
          disabled={!valid}
          contentStyle={styles.buttonContent}
          style={[
            styles.button,
            valid
              ? { backgroundColor: COLORS.primary }
              : { backgroundColor: COLORS.lightGray },
          ]}
          labelStyle={{ ...FONTS.h3, color: COLORS.white }}
        >
          Continue
        </Button>
        <TouchableOpacity onPress={() => navigation.navigate("SignIn")}>
          <Text
            style={{
              ...FONTS.body4,
              color: COLORS.primary,
              textAlign: "center",
              marginTop: SIZES.padding,
            }}
          >
            Existing user? <Text style={{ fontWeight: "bold" }}>Sign in</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: "center",
    paddingHorizontal: SIZES.padding,
  },
  headerContainer: {
    alignItems: "center",
    marginBottom: SIZES.padding,
  },
  appName: {
    ...FONTS.h1,
    color: COLORS.primary,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 10,
    padding: SIZES.padding * 2,
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
  input: {
    backgroundColor: COLORS.white,
    marginTop: SIZES.padding/2,
  },
  errorText: {
    ...FONTS.body4,
    color: COLORS.red2,
    marginTop: SIZES.base / 2,
  },
  buttonContent: {
    height: 50,
  },
  button: {
    marginTop: SIZES.padding,
    borderRadius: 10,
  },
});
