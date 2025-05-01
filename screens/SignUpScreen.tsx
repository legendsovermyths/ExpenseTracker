import React, { useState, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text } from 'react-native-paper';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { COLORS, FONTS, SIZES } from '../constants';
import { supabase } from '../services/Supabase';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [valid, setValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [supabaseError, setSupabaseError] = useState('');

  const route: any = useRoute();
  const navigation: any = useNavigation();
  const { name, phone } = route.params;

  const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

  useEffect(() => {
    let eErr = '';
    if (email && !EMAIL_REGEX.test(email)) {
      eErr = 'Enter a valid email address';
    }
    setEmailError(eErr);

    let pErr = '';
    if (password && password.length < 6) {
      pErr = 'Password must be at least 6 characters';
    }
    setPasswordError(pErr);

    setValid(EMAIL_REGEX.test(email) && password.length >= 6);
  }, [email, password]);

  const handleContinue = async () => {
    setLoading(true);
    setSupabaseError('');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name, phone }
      }
    });
    setLoading(false);
    if (error) {
      setSupabaseError(error.message);
      return;
    }
    navigation.navigate('OTPScreen', { name, phone, email });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.subtitle}>
          Create your account with email & password
        </Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          mode="outlined"
          style={styles.input}
          outlineColor={COLORS.lightGray}
          activeOutlineColor={COLORS.primary}
          placeholder="you@example.com"
        />
        {emailError ? (
          <Text style={styles.errorText}>{emailError}</Text>
        ) : null}

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          mode="outlined"
          style={styles.input}
          outlineColor={COLORS.lightGray}
          activeOutlineColor={COLORS.primary}
          placeholder="••••••••"
        />
        {passwordError ? (
          <Text style={styles.errorText}>{passwordError}</Text>
        ) : null}

        {supabaseError ? (
          <Text style={styles.errorText}>{supabaseError}</Text>
        ) : null}

        <Button
          mode="contained"
          onPress={handleContinue}
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
          {loading ? 'Sending...' : 'Continue'}
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    paddingHorizontal: SIZES.padding,
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
    marginTop: SIZES.padding,
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
