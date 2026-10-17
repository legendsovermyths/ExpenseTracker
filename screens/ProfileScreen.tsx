import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, TextInput } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { SPACE } from "../constants";
import { BottomBar, Button, Field, Page, RowGroup, Text } from "../components/ui";

const PHONE_REGEX = /^\+\d{10,15}$/;

export default function ProfileScreen() {
  const navigation: any = useNavigation();
  const phoneRef = useRef<TextInput>(null);

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [valid, setValid] = useState(false);


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
    <Page
      title="Welcome"
      back={false}
      footer={
        <BottomBar>
          <Button title="Continue" onPress={handleContinue} disabled={!valid} />
          <Button title="I already have an account" variant="secondary" onPress={() => navigation.navigate("SignIn")} />
        </BottomBar>
      }
    >
      <Text variant="body" tone="muted" style={styles.lead}>
        Tell us your name and phone number to get started.
      </Text>

      <RowGroup>
        <Field
          label="Full name"
          value={name}
          onChangeText={setName}
          placeholder="John Doe"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => phoneRef.current?.focus()}
          error={nameError}
        />
        <Field
          ref={phoneRef}
          label="Phone number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          placeholder="+11234567890"
          autoComplete="tel"
          textContentType="telephoneNumber"
          error={phoneError}
        />
      </RowGroup>
    </Page>
  );
}

const styles = StyleSheet.create({
  lead: { marginBottom: SPACE.xl },
});
